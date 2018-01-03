'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /**
                                                                                                                                                                                                                                                                   * @module
                                                                                                                                                                                                                                                                   **/


var _persistenceHelpers = require('./persistence-helpers.js');

var _package = require('../../package.json');

var _package2 = _interopRequireDefault(_package);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const DEFAULT_GRACE = 60 * 60 * 24 * 1000;

/**
 * @description Create new persistentCache middleware instance to be used by inMemoryCache
 * @param {function} redisFactory - provides a redisClient with publish/subscribe features
 * @param {RegExp} options.doNotPersist - regexp-matching of keys that are not to peristed
 * @param {String} options.keySpace - Prefix to use for keys in redis
 * @param {number} options.expire - Keys stored in redis expire in seconds
 * @returns {Object} middleware facade
 **/

exports.default = (redisFactory, {
  doNotPersist = null,
  keySpace = '',
  grace = DEFAULT_GRACE,
  bootload = true
} = {}) => cacheInstance => {
  const redisClient = redisFactory();
  const cacheKeyPrefix = `${_package2.default.name}-${keySpace}`;
  const persisting = {};

  const persist = (key, val) => {
    if ((!doNotPersist || !doNotPersist.test(key)) && (0, _persistenceHelpers.isSerializable)(val) && !persisting[key]) {
      persisting[key] = true;
      const redisKey = (0, _persistenceHelpers.getRedisKey)(cacheKeyPrefix, key);
      cacheInstance.log.debug(`Persist to key "${redisKey}"`);
      const valWithMeta = cacheInstance.get(key);
      redisClient.set(redisKey, JSON.stringify(valWithMeta), 'ex', Math.round((valWithMeta.TTL + grace) / 1000), err => {
        if (err) {
          cacheInstance.log.warn(err);
        }
        delete persisting[key];
      });
    } else {
      cacheInstance.log.debug(`skipping persistence of promised object with key ${key}`);
    }
  };

  const get = (...args) => {
    const next = args.pop();
    return next(...args).then(val => {
      const [key] = args;
      if (val.cache === 'miss') {
        persist(key, val);
        // return valj
        // if ((!doNotPersist || !doNotPersist.test(key)) && isSerializable(obj) && !persisting[key]) {
        //   persisting[key] = true
        //   const redisKey = getRedisKey(cacheKeyPrefix, key)
        //   cacheInstance.log.debug(`Persist to key "${redisKey}"`)
        //   const objWithMeta = cacheInstance.get(key)
        //   redisClient.set(redisKey, JSON.stringify(objWithMeta), 'ex', Math.round((objWithMeta.TTL + grace) / 1000), (err) => {
        //     if (err) {
        //       cacheInstance.log.warn(err)
        //     }
        //     delete persisting[key]
        //   })
        // } else {
        //   cacheInstance.log.debug(`skipping persistence of promised object with key ${key}`)
        // }
      }
      return val;
    });
  };

  const set = (...args) => {
    const next = args.pop();
    next(...args);
    const [key, val] = args;
    persist(key, val);
  };

  const del = (key, next) => {
    return (0, _persistenceHelpers.deleteKey)((0, _persistenceHelpers.getRedisKey)(cacheKeyPrefix, key), redisClient).then(() => {
      next(key);
    });
  };

  const clear = next => {
    return (0, _persistenceHelpers.deleteKeys)(cacheKeyPrefix, redisClient).then(() => {
      next();
    });
  };

  const load = (nowDefault = Date.now()) => {
    const now = nowDefault;
    return (0, _persistenceHelpers.loadObjects)(cacheKeyPrefix, redisClient, cacheInstance.log).then(mapLoaded => {
      Object.keys(mapLoaded).map(key => {
        cacheInstance.set((0, _persistenceHelpers.extractKeyFromRedis)(cacheKeyPrefix, key), mapLoaded[key].value, mapLoaded[key].TTL - (now - mapLoaded[key].created));
        return key;
      });
      cacheInstance.log.info(`Read ${Object.keys(mapLoaded).length} keys from redis. Used ${Date.now() - now} ms`);
    });
  };

  const debug = (extraData, next) => {
    return next(_extends({ cacheKeyPrefix }, extraData));
  };

  const onDispose = key => {
    (0, _persistenceHelpers.deleteKey)((0, _persistenceHelpers.getRedisKey)(cacheKeyPrefix, key), redisClient).then(() => {
      cacheInstance.log.debug(`deleting key ${key} from redis (evicted by lru-cache)`);
    }).catch(err => {
      cacheInstance.log.error(err);
    });
  };

  cacheInstance.addDisposer(onDispose);

  const destroy = () => {
    cacheInstance.removeDisposer(onDispose);
  };

  if (bootload) {
    load().catch(cacheInstance.log.error);
  }

  return {
    get,
    set,
    del,
    clear,
    load,
    debug,
    destroy
  };
};