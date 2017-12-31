'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _debug = require('../debug');

var _expect = require('expect.js');

var _expect2 = _interopRequireDefault(_expect);

var _lruCache = require('lru-cache');

var _lruCache2 = _interopRequireDefault(_lruCache);

var _cacheHelpers = require('../cache-helpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

describe('debug', () => {
  describe('-> formatWait', () => {
    it('should print waiting if wait is set', () => {
      // const isWaiting = formatWait(createWait(10000, new Date('2017-09-05T08:00:00Z').getTime()))
      const waiting = (0, _cacheHelpers.createWait)(10000, new Date('2017-09-04T08:01:00Z').getTime());
      const key = 'hei';
      const value = {
        value: 'verden',
        created: new Date('2017-09-04T08:00:00Z').getTime(),
        TTL: 60000
      };
      const full = false;
      const debugKey = (0, _debug.buildKey)({ key, value, waiting, full });
      (0, _expect2.default)(debugKey).to.eql({
        key: 'hei',
        created: new Date('2017-09-04T08:00:00.000Z'),
        expired: new Date('2017-09-04T08:01:00.000Z'),
        waiting: {
          started: new Date('2017-09-04T08:01:00.000Z'),
          wait: 10000,
          waitUntil: new Date('2017-09-04T08:01:10.000Z')
        }
      });
    });

    it('should not print waiting if wait is not set', () => {
      const key = 'hei';
      const value = {
        value: 'verden',
        created: new Date('2017-09-04T08:00:00Z').getTime(),
        TTL: 60000
      };
      const full = false;
      const debugKey = (0, _debug.buildKey)({ key, value, full });
      (0, _expect2.default)(debugKey).to.eql({
        key: 'hei',
        created: new Date('2017-09-04T08:00:00.000Z'),
        expired: new Date('2017-09-04T08:01:00.000Z')
      });
    });
  });

  describe('getCacheInfo', () => {
    it('should print debug info from cache', () => {
      const maxAge = 10000;
      const cache = (0, _lruCache2.default)({
        max: 100,
        maxAge
      });

      const entry = _extends({}, (0, _cacheHelpers.createEntry)({ hello: 'world' }, 12345), { cache: 'hit' });
      const entry2 = _extends({}, (0, _cacheHelpers.createEntry)({ foo: 'bar' }, 12345), { cache: 'hit' });
      const entry3 = _extends({}, (0, _cacheHelpers.createEntry)({ hello: 'world' }, -1), { cache: 'hit' });
      cache.set('yo', entry);
      cache.set('notinresults', entry2);
      cache.set('yo2', entry3);
      // omit now and waiting field
      const _getCacheInfo = (0, _debug.getCacheInfo)({
        full: true,
        search: 'yo*',
        cache,
        maxAge,
        waiting: new Map()
      }),
            { now, waiting } = _getCacheInfo,
            info = _objectWithoutProperties(_getCacheInfo, ['now', 'waiting']);
      (0, _expect2.default)(info).to.eql({
        full: true,
        itemCount: 3,
        keys: {
          hot: [{
            created: new Date(entry.created),
            expires: new Date(entry.created + entry.TTL),
            key: 'yo',
            value: {
              hello: 'world'
            }
          }],
          stale: [{
            created: new Date(entry3.created),
            expired: new Date(entry3.created + entry3.TTL),
            key: 'yo2',
            value: {
              hello: 'world'
            }
          }]
        },
        maxAge: '0.002777777777777778h',
        search: 'yo*'
      });
    });
  });
});