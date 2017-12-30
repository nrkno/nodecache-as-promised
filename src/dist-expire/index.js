/**
 * @module
 **/
import os from 'os'

const EXPIRE_MESSAGE_TYPE = 'EXPIRE_MESSAGE_TYPE'

/**
 * @description Create new middlware instance to be used by inMemoryCache module
 * @param {function} redisFactory - provides a redisClient with publish/subscribe features
 * @param {String} namespace - namespace to publish/subscribe messages (eg. http://desketoy:8080/)
 * @returns {Object} middleware facade
 * @returns {function} object.get method
 * @returns {function} object.set method
 * @returns {function} object.expire method
 * @returns {function} object.debug method
 **/
export default (redisFactory, namespace) => (cacheInstance) => {
  const redisPub = redisFactory()
  const redisSubClient = redisFactory()

  /**
   * @description callback for messages recieved from redis
   * @param {String} namespace - namespace that were used to transmit message
   * @param {String} data - JSON-encoded message
   * @returns {undefined}
   **/
  const onMessage = (namespace, data) => {
    try {
      const {type, message} = JSON.parse(data)
      if (type === EXPIRE_MESSAGE_TYPE) {
        cacheInstance.log.info(`expire cache for keys ${message.keys} using namespace ${namespace} on host ${os.hostname()}`)
        cacheInstance.expire(message.keys)
      }
    } catch (e) {
      cacheInstance.log.error(`failed to parse message on ${namespace} - ${data}. Reason: ${e}`)
    }
  }

  /**
   * @description setup subscription to redis
   * @param {RedisClient} redisClient - a connected redisClient
   * @param {String} namespace - namespace to publish/subscribe messages (eg. http://desketoy:8080/)
   * @returns {undefined}
   **/
  const setupSubscriber = (redisClient, namespace) => {
    redisClient.subscribe(namespace, (err, cnt) => {
      if (err) {
        return cacheInstance.log.error(`oh oh. Subscribing for redis#${namespace} failed`)
      }
      return cacheInstance.log.debug(`Subscribing for incoming messages from redis#${namespace}. Count: ${cnt}`)
    })
    redisClient.on('message', onMessage)
  }

  /**
   * @description distributed wrapper for expire calls
   * @param {Array<String>} keys - Array of keys. Accepts * as wildcards (converted to .*)
   * @returns {undefined}
   **/
  const expire = (keys) => {
    const message = {
      type: EXPIRE_MESSAGE_TYPE,
      message: {
        keys
      }
    }
    redisPub.publish(namespace, JSON.stringify(message))
  }

  const debug = (extraData, next) => {
    return next({namespace, ...extraData})
  }

  setupSubscriber(redisSubClient, namespace)

  return {
    expire,
    debug
  }
}
