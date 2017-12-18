import fs from 'fs'

/**
 * @description Create new instance
 * @param {Object} cacheInstance - an instance of CacheManager
 * @param {String} pathToDump - path to json-file used for cache dumps
 * @param {RegExp} doNotPersist - mathcing regexp for keys will not be persisted to dump
 * @returns {Object} facade
 **/
export default (cacheInstance, pathToDump, doNotPersist) => {
  const dumpCache = () => {
    doNotPersist && cacheInstance.cache.forEach((value, key) => {
      if (doNotPersist.test(key)) {
        cacheInstance.cache.del(key)
      }
    })
    const dump = cacheInstance.cache.dump()
    try {
      fs.writeFileSync(pathToDump, JSON.stringify(dump), 'utf-8');  // eslint-disable-line
      cacheInstance.log.info(`wrote cache to file sucessfully. Location: ${pathToDump}`)
    } catch (err) {
      cacheInstance.log.error(err)
    }
  }

  // docker shutdown
  process.on('SIGINT', dumpCache)

  const load = () => {
    return new Promise((resolve, reject) => {
      fs.readFile(pathToDump, 'utf-8', (err, res) => {
        if (err) {
          return resolve(`Error reading dumpfile ${pathToDump}. ${err}`)
        }
        try {
          cacheInstance.cache.load(JSON.parse(res))
          return resolve(`read cache from file sucessfully. Location: ${pathToDump}`)
        } catch (e) {
          return reject(e)
        }
      })
    })
  }

  const debug = (extraOptions) => {
    return cacheInstance.debug({pathToDump, ...extraOptions})
  }

  return {
    ...cacheInstance,
    debug,
    load
  }
}
