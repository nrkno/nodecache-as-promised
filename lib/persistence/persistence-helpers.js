'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isSerializable = exports.loadObjects = exports.deleteKeys = exports.deleteKey = exports.scanKeys = exports.readKeys = exports.getRedisKey = exports.extractKeyFromRedis = undefined;

var _isUndefined = require('lodash/isUndefined');

var _isUndefined2 = _interopRequireDefault(_isUndefined);

var _isNull = require('lodash/isNull');

var _isNull2 = _interopRequireDefault(_isNull);

var _isBoolean = require('lodash/isBoolean');

var _isBoolean2 = _interopRequireDefault(_isBoolean);

var _isNumber = require('lodash/isNumber');

var _isNumber2 = _interopRequireDefault(_isNumber);

var _isString = require('lodash/isString');

var _isString2 = _interopRequireDefault(_isString);

var _isArray = require('lodash/isArray');

var _isArray2 = _interopRequireDefault(_isArray);

var _isPlainObject = require('lodash/isPlainObject');

var _isPlainObject2 = _interopRequireDefault(_isPlainObject);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const MAX_PAGE_SIZE = 100; /**
                            * @module
                            **/
const extractKeyFromRedis = exports.extractKeyFromRedis = (prefix, key) => {
  return key.replace(new RegExp(`${prefix}-`), '');
};

const getRedisKey = exports.getRedisKey = (prefix, key = '') => {
  return `${[prefix, key].join('-')}`;
};

const readKeys = exports.readKeys = (keys, redisClient, log) => {
  if (keys.length === 0) {
    return Promise.resolve({});
  }
  const p = [];
  for (let i = 0; i < keys.length; i = i + MAX_PAGE_SIZE) {
    const keysToRead = keys.slice(i, i + MAX_PAGE_SIZE);
    p.push(new Promise(resolve => {
      redisClient.mget(keysToRead, (err, results) => {
        if (err) {
          log.warn(`could not read keys into cache, reason: ${err}`);
          resolve({});
          return;
        }
        resolve(keysToRead.reduce((acc, key, i) => {
          try {
            acc[key] = JSON.parse(results[i]);
          } catch (e) {
            log.warn(`could not parse value for ${key} as JSON. ${results[i]}`);
          }
          return acc;
        }, {}));
      });
    }));
  }
  return Promise.all(p).then(results => {
    return results.reduce((acc, next) => {
      Object.assign(acc, next);
      return acc;
    }, {});
  });
};

const scanKeys = exports.scanKeys = (cacheKeyPrefix, redisClient) => {
  const keys = [];
  return new Promise((resolve, reject) => {
    const stream = redisClient.scanStream({
      match: `${cacheKeyPrefix}*`,
      count: 100
    });
    stream.on('data', resultKeys => {
      keys.push(...resultKeys);
    });
    stream.on('end', () => {
      resolve(keys);
    });
    stream.on('error', err => {
      reject(err);
    });
  });
};

const deleteKey = exports.deleteKey = (key, redisClient) => {
  return new Promise((resolve, reject) => {
    redisClient.del(key, (err, res) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(res);
    });
  });
};

const deleteKeys = exports.deleteKeys = (cacheKeyPrefix, redisClient) => {
  return scanKeys(cacheKeyPrefix, redisClient).then(keys => {
    return Promise.all(keys.map(key => deleteKey(key, redisClient)));
  });
};

const loadObjects = exports.loadObjects = (cacheKeyPrefix, redisClient, log) => {
  return scanKeys(cacheKeyPrefix, redisClient).then(keys => {
    return readKeys(keys, redisClient, log);
  });
};

// credits to https://stackoverflow.com/users/128816/treznik
// https://stackoverflow.com/questions/30579940/reliable-way-to-check-if-objects-is-serializable-in-javascript
const isSerializable = exports.isSerializable = obj => {
  if ((0, _isUndefined2.default)(obj) || (0, _isNull2.default)(obj) || (0, _isBoolean2.default)(obj) || (0, _isNumber2.default)(obj) || (0, _isString2.default)(obj)) {
    return true;
  }

  if (!(0, _isPlainObject2.default)(obj) && !(0, _isArray2.default)(obj)) {
    return false;
  }

  for (var key in obj) {
    if (!isSerializable(obj[key])) {
      return false;
    }
  }

  return true;
};
//# sourceMappingURL=persistence-helpers.js.map