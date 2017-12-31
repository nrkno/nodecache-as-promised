/**
 * @module
 * @description Main module for creating an in-memory cache. Extendable using redis-wrapper and redis-persistence-wrapper
 **/
import cloneDeep from 'lodash/cloneDeep'
import {
  // existsAndNotStale,
  createEntry,
  createObservable,
  createWait,
  createRegExp,
  waitingForError,
  isFresh,
  isWaiting
} from './utils/cache-helpers'
import {
  getCacheInfo
} from './utils/debug'
import lruCache from 'lru-cache'

// export plugins for convenience
import dc from './dist-expire'
import pc from './persistence'

export const distCache = dc
export const persistentCache = pc

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

  let disposers = []
  const jobs = new Map()
  const waiting = new Map()
  const cache = lruCache({
    max: maxLength,
    maxAge,
    dispose: (key, value) => {
      disposers.forEach((disposer) => disposer(key, value))
    }
  })

  /**
   * @description add a callback to lruCache#dispose
   * @access public
   * @param {function} callback - a function to be called when a cache key is evicted
   * @returns {undefined}
   **/
  const addDisposer = (cb) => disposers.push(cb)

  /**
   * @description remove a callback from lruCache#dispose
   * @access public
   * @param {function} callback - a function to be called when a cache key is evicted
   * @returns {undefined}
   **/
  const removeDisposer = (cb) => (disposers = disposers.filter((disposer) => disposer && disposer !== cb))

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
   * @description check if key exists in cache
   * @access public
   * @param {String} key - key in cache to lookup.
   * @returns {Boolean} - true|false key exists in cache
   **/
  const has = (key) => {
    return cache.has(key)
  }

  /**
   * @description delete key from cache
   * @access public
   * @param {String} key - key in cache to delete
   * @returns {undefined}
   **/
  const del = (key) => {
    cache.del(key)
  }

  /**
   * @description removes all cache entries
   * @access public
   * @returns {undefined}
   **/
  const clear = () => {
    cache.reset()
  }

  /**
   * @description Create a job that subscribes to a rxJs-worker
   * @access private
   * @param {Object} options - an options object.
   * @param {String} options.key - key to create worker for.
   * @param {function} options.worker - function wrapper that returns a promise to fill cache object.
   * @param {number} workertimeout - max time allowed to run promise.
   * @param {number} ttl - ttl (in ms) before cached object becomes stale.
   * @param {number} deltaWait - delta wait (in ms) before retrying promise.
   * @returns {undefined}
   **/
  const _createJob = ({key, worker, workerTimeout, ttl, deltaWait}) => {
    const observable = createObservable(worker, workerTimeout)
    const onNext = (value) => {
      // update cache
      set(key, value, ttl)
      waiting.delete(key)
      jobs.delete(key)
    }
    const onError = (err) => {
      // handle error
      log.error(err)
      waiting.set(key, createWait(deltaWait))
      jobs.delete(key)
    }
    const onComplete = () => {
      jobs.delete(key)
    }
    observable.subscribe(onNext, onError, onComplete)
    return observable
  }

  /**
   * @description Read from cache, check if stale, run promise (in a dedicated worker) or wait for other worker to complete
   * @access private
   * @param {Object} options - an options object.
   * @param {function} options.worker - function wrapper that returns a promise to fill cache object.
   * @param {String} options.key - key to create worker for.
   * @param {number} workertimeout - max time allowed to run promise.
   * @param {number} ttl - ttl (in ms) before cached object becomes stale.
   * @param {number} deltaWait - delta wait (in ms) before retrying promise, when stale.
   * @returns {Promise} resolves/rejects when request operation finishes
   **/
  const _requestFromCache = ({worker, key, workerTimeout, ttl, deltaWait}) => {
    const obj = cache.get(key)
    if (!worker) {
      return (obj && isFresh(obj) && obj) ||
              (obj && {...obj, cache: CACHE_STALE}) ||
              null
    } if (obj && isFresh(obj) && !waiting.get(key)) {
      return Promise.resolve(obj)
    } else if (obj && (!worker || isWaiting(waiting.get(key)))) {
      return Promise.resolve({...obj, cache: CACHE_STALE})
    } else if (isWaiting(waiting.get(key))) {
      return Promise.reject(waitingForError(key, waiting.get(key)))
    }

    return new Promise((resolve, reject) => {
      let job = jobs.get(key)
      let cacheType = CACHE_HIT
      if (!job) {
        cacheType = CACHE_MISS
        job = _createJob({
          key,
          worker,
          workerTimeout,
          ttl,
          deltaWait
        })
        jobs.set(key, job)
      }
      job.subscribe((value) => {
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
   * @param {function} config.worker - function wrapper that returns a promise to fill cache object.
   * @returns {Promise} resolves/rejects when request operation finishes
   **/
  const get = (key, config = {}) => {
    // TODO: support stale-while-revalidate
    const {
      ttl = DEFAULT_CACHE_EXPIRE,
      workerTimeout = 5000,
      deltaWait = DEFAULT_DELTA_WAIT,
      worker
    } = config
    return _requestFromCache({
      worker,
      key,
      workerTimeout,
      ttl,
      deltaWait
    })
  }

  /**
   * @description get keys from cache
   * @access public
   * @returns {Array<String>} - keys
   **/
  const keys = () => cache.keys()

  /**
   * @description get values from cache
   * @access public
   * @returns {Array<Any>} - values
   **/
  const values = () => cache.values()

  /**
   * @description get cache entries
   * @access public
   * @returns {Map<<String, Any>} - values
   **/
  const entries = () => {
    const vals = values()
    return new Map(keys().reduce((acc, key, i) => {
      // console.log({[key]: vals[i]})
      acc.push([key, vals[i]])
      return acc
    }, []))
  }

  /**
   * @description expire a cache key (ie. set TTL = 0)
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
          set(key, obj.value, 0)  // TTL = 0
          waiting.delete(key)
        })
    })
  }

  const debug = (extraData = {}) => {
    return getCacheInfo({
      maxAge,
      maxLength,
      ...options,
      ...extraData,
      cache,
      waiting
    })
  }

  Object.keys(initial).forEach((key) => {
    set(key, cloneDeep(initial[key]))
  })

  const buildFacade = () => {
    return {
      get,
      set,
      has,
      del,
      keys,
      values,
      entries,
      clear,
      expire,
      addDisposer,
      removeDisposer,
      // helpers
      debug,
      log,
      // for testing purposes
      cache,
      waiting
    }
  }

  const facade = buildFacade()

  facade.use = (middleware) => {
    const m = middleware(buildFacade())
    Object.keys(m).forEach((key) => {
      // Keep a reference to the original function pointer
      const prevFacade = facade[key]
      // overwrite/mutate the original function
      facade[key] = (...args) => {
        // call middlware function
        return m[key](
          // add next parameter
          ...args.concat((...middlewareArgs) => {
            // call original function with args from middleware
            return prevFacade(...middlewareArgs)
          })
        )
      }
    })
  }

  return facade
}
