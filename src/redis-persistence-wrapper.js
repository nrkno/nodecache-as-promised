/**
 * @module
 **/
import {
  syncCacheWithRedis,
  scanKeys,
  createRegExp,
  isSerializable
} from './persistence-helpers.js'
import pkg from '../package.json'

const DEFAULT_EXPIRE = 60 * 60 * 24

/**
 * @description Create new instance
 * @param {Object} cacheInstance - an instance of CacheManager
 * @param {function} redisFactory - provides a redisClient with publish/subscribe features
 * @param {RegExp} options.doNotPersist - regexp-matching of keys that are not to peristed
 * @param {String} options.keySpace - Prefix to use for keys in redis
 * @param {number} options.expire - Keys stored in redis expire in seconds
 * @returns {Object} facade
 **/
export default (cacheInstance,
  redisFactory,
  {
    doNotPersist = null,
    keySpace = pkg.name,
    expire = DEFAULT_EXPIRE
  } = {}
) => {
  const redisClient = redisFactory()
  const cacheKeyPrefix = keySpace.replace(/https?|\/|:|\./g, '')
  const persisting = {}

  const get = (...args) => {
    return cacheInstance.get(...args).then((obj) => {
      const [key] = args
      if (obj.cache === 'miss' && (!doNotPersist || !doNotPersist.test(key)) && isSerializable(obj) && !persisting[key]) {
        persisting[key] = true
        const redisKey = `${cacheKeyPrefix}-${Date.now()}${key}`
        cacheInstance.log.debug(`Persist to key "${redisKey}"`)
        redisClient.set(redisKey, JSON.stringify(cacheInstance.cache.get(key)), 'ex', expire, (err) => {
          if (err) {
            cacheInstance.log.warn(err)
          }
          delete persisting[key]
        })
      } else {
        cacheInstance.log.warn(`skipping persistence of promised object with key ${key}`)
      }
      return obj
    })
  }

  const re = createRegExp(cacheKeyPrefix)

  const load = () => {
    const then = Date.now()
    return new Promise((resolve, reject) => {
      scanKeys(redisClient, cacheKeyPrefix).then((keys) => {
        return syncCacheWithRedis({
          keys,
          regexp: re,
          maxLength: cacheInstance.maxLength,
          redisClient,
          log: cacheInstance.log
        }).then(([keysDeleted, mapLoaded]) => {
          return [
            keysDeleted,
            Object.keys(mapLoaded).map((key) => {
              cacheInstance.cache.set(key.replace(re, ''), mapLoaded[key])
              return key
            })
          ]
        }).then(([keysDeleted, keysLoaded]) => {
          resolve(`Deleted ${keysDeleted.length} keys, read ${keysLoaded.length} keys from redis. Used ${Date.now() - then} ms`)
        })
      }).catch(reject)
    })
  }

  const debug = (extraOptions) => {
    return cacheInstance.debug({cacheKeyPrefix, ...extraOptions})
  }

  return {
    ...cacheInstance,
    get,
    load,
    debug
  }
}
