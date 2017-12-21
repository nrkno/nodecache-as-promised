/**
 * @module
 * @description Main module for creating an in-memory cache. Extendable using redis-wrapper and redis-persistence-wrapper
 **/
import cloneDeep from 'lodash/cloneDeep'
import {
  existsAndNotStale,
  createEntry,
  createObservable,
  finishedWaiting,
  createWait,
  createRegExp,
  waitingForError
} from './utils/cache-helpers'
import {
  getCacheInfo
} from './utils/debug'
import lruCache from 'lru-cache'

// export plugins for convenience
export {default as distCache} from './dist-expire'
export {default as persistentCache} from './persistence'

const DEFAULT_CACHE_EXPIRE = 24 * 60 * 60 * 1000
const DEFAULT_DELTA_WAIT = 10000
const DEFAULT_MAX_LENGTH = 1000
// max stale period
const DEFAULT_MAX_AGE = 2 * DEFAULT_CACHE_EXPIRE

const CACHE_HIT = 'hit'
const CACHE_MISS = 'miss'
const CACHE_STALE = 'stale'

/**
 * Wrapper around LRU-cache,
 * able to set values from promises
 * in get-operations
 **/

 /**
  * @description Creates a new in-memory cache.
  * @param {Object} options - an options object.
  * @param {function} options.log - logger interface. Expects standard methods: info, warn, error, debug, trace
  * @param {Object} options.initial - initial state, key/value based.
  * @param {number} options.maxLength - max LRU-size (object count)
  * @param {number} options.maxAge - max LRU-age (UX timestamp)
  * @returns {Object} facade
  * @returns {function} object.get method
  * @returns {function} object.set method
  * @returns {function} object.expire method
  * @returns {function} object.debug method
  **/
export default (options) => {
  const {
    log = console,  // eslint-disable-line
    initial = {},
    maxLength = DEFAULT_MAX_LENGTH,
    maxAge = DEFAULT_MAX_AGE
  } = options

  const workers = new Map()
  const waiting = new Map()
  const cache = lruCache({
    max: maxLength,
    maxAge
  })

  /**
   * @description set value in cache
   * @access public
   * @param {String} key - key in cache to lookup.
   * @param {any} value - value to store in cache
   * @param {number} ttl - ttl (in ms) before cached object becomes stale.
   * @returns {undefined}
   **/
  const set = (key, value, ttl = DEFAULT_CACHE_EXPIRE) => {
    cache.set(key, {...createEntry(value, ttl), cache: CACHE_HIT})
  }

  /**
   * @description Create/subscribe to rxJs-worker
   * @access private
   * @param {Object} options - an options object.
   * @param {String} options.key - key to create worker for.
   * @param {function} options.promise - function wrapper that returns a promise to fill cache object.
   * @param {number} workertimeout - max time allowed to run promise.
   * @param {number} ttl - ttl (in ms) before cached object becomes stale.
   * @param {number} deltaWait - delta wait (in ms) before retrying promise, when stale.
   * @returns {undefined}
   **/
  const _createWorker = ({key, promise, workerTimeout, ttl, deltaWait}) => {
    const worker = createObservable(promise, workerTimeout)
    const onNext = (value) => {
      // update cache
      set(key, value, ttl)
      waiting.delete(key)
      workers.delete(key)
    }
    const onError = (err) => {
      // handle error
      log.error(err)
      waiting.set(key, createWait(deltaWait))
      workers.delete(key)
    }
    const onComplete = () => {
      workers.delete(key)
    }
    worker.subscribe(onNext, onError, onComplete)
    return worker
  }

  /**
   * @description Read from cache, check if stale, run promise (in a dedicated worker) or wait for other worker to complete
   * @access private
   * @param {Object} options - an options object.
   * @param {function} options.promise - function wrapper that returns a promise to fill cache object.
   * @param {String} options.key - key to create worker for.
   * @param {number} workertimeout - max time allowed to run promise.
   * @param {number} ttl - ttl (in ms) before cached object becomes stale.
   * @param {number} deltaWait - delta wait (in ms) before retrying promise, when stale.
   * @returns {Promise} resolves/rejects when request operation finishes
   **/
  const _requestFromCache = ({promise, key, workerTimeout, ttl, deltaWait}) => {
    return new Promise((resolve, reject) => {
      const obj = cache.get(key)
      if (!promise) {
        // synchronous get
        resolve(obj ? obj.value : null)
        return
      } else if (existsAndNotStale(obj, waiting.get(key))) {
        // fresh or stale + wait
        if (obj) {
          if (obj.created + obj.TTL < Date.now()) {
            resolve({...obj, cache: CACHE_STALE})
            return
          }
          resolve(obj)
          return
        }
        reject(waitingForError(key, waiting.get(key)))
        return
      } else if (!obj && !finishedWaiting(waiting.get(key))) {
        // cold + wait get
        reject(waitingForError(key, waiting.get(key)))
        return
      }
      let worker = workers.get(key)
      let cacheType = CACHE_HIT
      if (!worker) {
        cacheType = CACHE_MISS
        worker = _createWorker({
          key,
          promise,
          workerTimeout,
          ttl,
          deltaWait
        })
        workers.set(key, worker)
      }
      worker.subscribe((value) => {
        resolve({value, cache: cacheType})
      }, (err) => {
        // serve stale object if it exists
        obj ? resolve({...obj, cache: CACHE_STALE}) : reject(err)
      })
    })
  }

  /**
   * @description get key from cache (or run promise to fill)
   * @access public
   * @param {String} key - key in cache to lookup.
   * @param {Object} config - (optional) an options object.
   * @param {number} config.ttl - ttl (in ms) before cached object becomes stale.
   * @param {number} config.workerTimeout - max time allowed to run promise.
   * @param {number} config.deltaWait - delta wait (in ms) before retrying promise, when stale.
   * @param {function} promise - (optional) function wrapper that returns a promise to fill cache object.
   * @returns {Promise} resolves/rejects when request operation finishes
   **/
  const get = (key, config = {}, promise) => {
    const {
      ttl = DEFAULT_CACHE_EXPIRE,
      workerTimeout = 5000,
      deltaWait = DEFAULT_DELTA_WAIT
    } = config
    return _requestFromCache({
      promise,
      key,
      workerTimeout,
      ttl,
      deltaWait
    })
  }

  /**
   * @description set value in cache
   * @access public
   * @param {Array<String>} keys - array of keys to expire (supports * as wildcards, converted to .* regexp)
   * @returns {undefined}
   **/
  const expire = (keys) => {
    keys.forEach((key) => {
      const search = createRegExp(key);
      [...cache.keys()]
        .filter((key) => search.test(key))
        .forEach((key) => {
          const obj = cache.get(key)
          set(key, obj.value, 0)
          waiting.delete(key)
        })
    })
  }

  const debug = (extraOptions = {}) => {
    return getCacheInfo({
      maxAge,
      maxLength,
      ...options,
      ...extraOptions,
      cache,
      waiting
    })
  }

  Object.keys(initial).forEach((key) => {
    set(key, cloneDeep(initial[key]))
  })

  return {
    get,
    set,
    expire,
    debug,
    log,
    maxLength,
    // for testing purposes
    cache,
    waiting
  }
}
