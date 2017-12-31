'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getCacheInfo = exports.buildKey = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /**
                                                                                                                                                                                                                                                                   * @module
                                                                                                                                                                                                                                                                   **/


var _cacheHelpers = require('./cache-helpers');

const buildKey = exports.buildKey = ({ key, value, waiting, full }) => {
  const expire = value.created + value.TTL;
  const expireKey = expire < Date.now() ? 'expired' : 'expires';
  return Object.assign({
    key,
    created: new Date(value.created),
    [expireKey]: new Date(expire)
  }, waiting ? {
    waiting: {
      started: new Date(waiting.started),
      wait: waiting.wait,
      waitUntil: new Date(waiting.waitUntil)
    }
  } : {}, full ? { value: value.value } : {});
};

const extractProps = obj => {
  const ret = {};
  Object.keys(obj).filter(key => !/^log$|^cache$/.test(key)).forEach(key => {
    ret[key] = obj[key];
  });
  return ret;
};

const getCacheInfo = exports.getCacheInfo = info => {
  const {
    full,
    search = '*',
    cache,
    maxAge,
    waiting
  } = info;
  const keys = {
    stale: [],
    hot: []
  };
  const matcher = (0, _cacheHelpers.createRegExp)(search);
  cache.forEach((value, key) => {
    if (!matcher.test(key)) {
      return;
    }
    const keyInfo = buildKey({ key, value, waiting: waiting.get(key), full });
    if ((0, _cacheHelpers.isFresh)(value)) {
      keys.hot.push(keyInfo);
    } else {
      keys.stale.push(keyInfo);
    }
  });
  return _extends({
    now: new Date()
  }, extractProps(info), {
    maxAge: `${maxAge / (1000 * 60 * 60)}h`,
    itemCount: cache.itemCount,
    keys
  });
};
//# sourceMappingURL=debug.js.map