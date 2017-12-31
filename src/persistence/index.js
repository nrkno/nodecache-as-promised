/**
 * @module
 **/
import {
  loadObjects,
  deleteKey,
  deleteKeys,
  extractKeyFromRedis,
  getRedisKey,
  isSerializable
} from './persistence-helpers.js'
import pkg from '../../package.json'

const DEFAULT_GRACE = 60 * 60 * 24 * 1000

/**
 * @description Create new persistentCache middleware instance to be used by inMemoryCache
 * @param {function} redisFactory - provides a redisClient with publish/subscribe features
 * @param {RegExp} options.doNotPersist - regexp-matching of keys that are not to peristed
 * @param {String} options.keySpace - Prefix to use for keys in redis
 * @param {number} options.expire - Keys stored in redis expire in seconds
 * @returns {Object} middleware facade
 **/
export default (redisFactory,
  {
    doNotPersist = null,
    keySpace = '',
    grace = DEFAULT_GRACE,
    bootload = true
  } = {}
) => (cacheInstance) => {
  const redisClient = redisFactory()
  const cacheKeyPrefix = `${pkg.name}-${keySpace}`
  const persisting = {}

  const get = (...args) => {
    const next = args.pop()
    return next(...args).then((obj) => {
      const [key] = args
      if (obj.cache === 'miss') {
        if ((!doNotPersist || !doNotPersist.test(key)) && isSerializable(obj) && !persisting[key]) {
          persisting[key] = true
          const redisKey = getRedisKey(cacheKeyPrefix, key)
          cacheInstance.log.debug(`Persist to key "${redisKey}"`)
          const objWithMeta = cacheInstance.get(key)
          redisClient.set(redisKey, JSON.stringify(objWithMeta), 'ex', Math.round((objWithMeta.TTL + grace) / 1000), (err) => {
            if (err) {
              cacheInstance.log.warn(err)
            }
            delete persisting[key]
          })
        } else {
          cacheInstance.log.debug(`skipping persistence of promised object with key ${key}`)
        }
      }
      return obj
    })
  }

  const del = (key, next) => {
    return deleteKey(getRedisKey(cacheKeyPrefix, key), redisClient).then(() => {
      next(key)
    })
  }

  const clear = (next) => {
    return deleteKeys(cacheKeyPrefix, redisClient).then(() => {
      next()
    })
  }

  const load = () => {
    const then = Date.now()
    return loadObjects(cacheKeyPrefix, redisClient, cacheInstance.log)
      .then((mapLoaded) => {
        Object.keys(mapLoaded).map((key) => {
          cacheInstance.set(extractKeyFromRedis(cacheKeyPrefix, key), mapLoaded[key].value, mapLoaded[key].TTL)
          return key
        })
        cacheInstance.log.info(`Read ${Object.keys(mapLoaded).length} keys from redis. Used ${Date.now() - then} ms`)
      })
  }

  const debug = (extraData, next) => {
    return next({cacheKeyPrefix, ...extraData})
  }

  const onDispose = (key) => {
    deleteKey(getRedisKey(cacheKeyPrefix, key), redisClient).then(() => {
      cacheInstance.log.debug(`deleting key ${key} from redis (evicted by lru-cache)`)
    }).catch((err) => {
      cacheInstance.log.error(err)
    })
  }

  cacheInstance.addDisposer(onDispose)

  const destroy = () => {
    cacheInstance.removeDisposer(onDispose)
  }

  if (bootload) {
    load().catch(cacheInstance.log.error)
  }

  return {
    get,
    del,
    clear,
    load,
    debug,
    destroy
  }
}
