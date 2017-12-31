'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.persistentCache = exports.distCache = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /**
                                                                                                                                                                                                                                                                   * @module
                                                                                                                                                                                                                                                                   * @description Main module for creating an in-memory cache. Extendable using redis-wrapper and redis-persistence-wrapper
                                                                                                                                                                                                                                                                   **/


// export plugins for convenience


var _cloneDeep = require('lodash/cloneDeep');

var _cloneDeep2 = _interopRequireDefault(_cloneDeep);

var _cacheHelpers = require('./utils/cache-helpers');

var _debug = require('./utils/debug');

var _lruCache = require('lru-cache');

var _lruCache2 = _interopRequireDefault(_lruCache);

var _distExpire = require('./dist-expire');

var _distExpire2 = _interopRequireDefault(_distExpire);

var _persistence = require('./persistence');

var _persistence2 = _interopRequireDefault(_persistence);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const distCache = exports.distCache = _distExpire2.default;
const persistentCache = exports.persistentCache = _persistence2.default;

const DEFAULT_CACHE_EXPIRE = 24 * 60 * 60 * 1000;
const DEFAULT_DELTA_WAIT = 10000;
const DEFAULT_MAX_LENGTH = 1000;
// max stale period
const DEFAULT_MAX_AGE = 2 * DEFAULT_CACHE_EXPIRE;

const CACHE_HIT = 'hit';
const CACHE_MISS = 'miss';
const CACHE_STALE = 'stale';

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

exports.default = options => {
  const {
    log = console, // eslint-disable-line
    initial = {},
    maxLength = DEFAULT_MAX_LENGTH,
    maxAge = DEFAULT_MAX_AGE
  } = options;

  let disposers = [];
  const jobs = new Map();
  const waiting = new Map();
  const cache = (0, _lruCache2.default)({
    max: maxLength,
    maxAge,
    dispose: (key, value) => {
      disposers.forEach(disposer => disposer(key, value));
    }
  });

  /**
   * @description add a callback to lruCache#dispose
   * @access public
   * @param {function} callback - a function to be called when a cache key is evicted
   * @returns {undefined}
   **/
  const addDisposer = cb => disposers.push(cb);

  /**
   * @description remove a callback from lruCache#dispose
   * @access public
   * @param {function} callback - a function to be called when a cache key is evicted
   * @returns {undefined}
   **/
  const removeDisposer = cb => disposers = disposers.filter(disposer => disposer && disposer !== cb);

  /**
   * @description set value in cache
   * @access public
   * @param {String} key - key in cache to lookup.
   * @param {any} value - value to store in cache
   * @param {number} ttl - ttl (in ms) before cached object becomes stale.
   * @returns {undefined}
   **/
  const set = (key, value, ttl = DEFAULT_CACHE_EXPIRE) => {
    cache.set(key, _extends({}, (0, _cacheHelpers.createEntry)(value, ttl), { cache: CACHE_HIT }));
  };

  /**
   * @description check if key exists in cache
   * @access public
   * @param {String} key - key in cache to lookup.
   * @returns {Boolean} - true|false key exists in cache
   **/
  const has = key => {
    return cache.has(key);
  };

  /**
   * @description delete key from cache
   * @access public
   * @param {String} key - key in cache to delete
   * @returns {undefined}
   **/
  const del = key => {
    cache.del(key);
  };

  /**
   * @description removes all cache entries
   * @access public
   * @returns {undefined}
   **/
  const clear = () => {
    cache.reset();
  };

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
  const _createJob = ({ key, worker, workerTimeout, ttl, deltaWait }) => {
    const observable = (0, _cacheHelpers.createObservable)(worker, workerTimeout);
    const onNext = value => {
      // update cache
      set(key, value, ttl);
      waiting.delete(key);
      jobs.delete(key);
    };
    const onError = err => {
      // handle error
      log.error(err);
      waiting.set(key, (0, _cacheHelpers.createWait)(deltaWait));
      jobs.delete(key);
    };
    const onComplete = () => {
      jobs.delete(key);
    };
    observable.subscribe(onNext, onError, onComplete);
    return observable;
  };

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
  const _requestFromCache = ({ worker, key, workerTimeout, ttl, deltaWait }) => {
    const obj = cache.get(key);
    if (!worker) {
      return obj && (0, _cacheHelpers.isFresh)(obj) && obj || obj && _extends({}, obj, { cache: CACHE_STALE }) || null;
    }if (obj && (0, _cacheHelpers.isFresh)(obj) && !waiting.get(key)) {
      return Promise.resolve(obj);
    } else if (obj && (!worker || (0, _cacheHelpers.isWaiting)(waiting.get(key)))) {
      return Promise.resolve(_extends({}, obj, { cache: CACHE_STALE }));
    } else if ((0, _cacheHelpers.isWaiting)(waiting.get(key))) {
      return Promise.reject((0, _cacheHelpers.waitingForError)(key, waiting.get(key)));
    }

    return new Promise((resolve, reject) => {
      let job = jobs.get(key);
      let cacheType = CACHE_HIT;
      if (!job) {
        cacheType = CACHE_MISS;
        job = _createJob({
          key,
          worker,
          workerTimeout,
          ttl,
          deltaWait
        });
        jobs.set(key, job);
      }
      job.subscribe(value => {
        resolve({ value, cache: cacheType });
      }, err => {
        // serve stale object if it exists
        obj ? resolve(_extends({}, obj, { cache: CACHE_STALE })) : reject(err);
      });
    });
  };

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
    } = config;
    return _requestFromCache({
      worker,
      key,
      workerTimeout,
      ttl,
      deltaWait
    });
  };

  /**
   * @description get keys from cache
   * @access public
   * @returns {Array<String>} - keys
   **/
  const keys = () => cache.keys();

  /**
   * @description get values from cache
   * @access public
   * @returns {Array<Any>} - values
   **/
  const values = () => cache.values();

  /**
   * @description get cache entries
   * @access public
   * @returns {Map<<String, Any>} - values
   **/
  const entries = () => {
    const vals = values();
    return new Map(keys().reduce((acc, key, i) => {
      // console.log({[key]: vals[i]})
      acc.push([key, vals[i]]);
      return acc;
    }, []));
  };

  /**
   * @description expire a cache key (ie. set TTL = 0)
   * @access public
   * @param {Array<String>} keys - array of keys to expire (supports * as wildcards, converted to .* regexp)
   * @returns {undefined}
   **/
  const expire = keys => {
    keys.forEach(key => {
      const search = (0, _cacheHelpers.createRegExp)(key);
      [...cache.keys()].filter(key => search.test(key)).forEach(key => {
        const obj = cache.get(key);
        set(key, obj.value, 0); // TTL = 0
        waiting.delete(key);
      });
    });
  };

  const debug = (extraData = {}) => {
    return (0, _debug.getCacheInfo)(_extends({
      maxAge,
      maxLength
    }, options, extraData, {
      cache,
      waiting
    }));
  };

  Object.keys(initial).forEach(key => {
    set(key, (0, _cloneDeep2.default)(initial[key]));
  });

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
      waiting
    };
  };

  const facade = buildFacade();

  facade.use = middleware => {
    const m = middleware(buildFacade());
    Object.keys(m).forEach(key => {
      // Keep a reference to the original function pointer
      const prevFacade = facade[key];
      // overwrite/mutate the original function
      facade[key] = (...args) => {
        // call middlware function
        return m[key](
        // add next parameter
        ...args.concat((...middlewareArgs) => {
          // call original function with args from middleware
          return prevFacade(...middlewareArgs);
        }));
      };
    });
  };

  return facade;
};
//# sourceMappingURL=index.js.map