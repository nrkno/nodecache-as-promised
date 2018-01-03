'use strict';

var _ = require('../');

var _2 = _interopRequireDefault(_);

var _3 = require('../../');

var _4 = _interopRequireDefault(_3);

var _sinon = require('sinon');

var _sinon2 = _interopRequireDefault(_sinon);

var _expect = require('expect.js');

var _expect2 = _interopRequireDefault(_expect);

var _mockRedisFactory = require('../../utils/mock-redis-factory');

var _persistenceHelpers = require('../persistence-helpers');

var utils = _interopRequireWildcard(_persistenceHelpers);

var _cacheHelpers = require('../../utils/cache-helpers');

var _logHelper = require('../../utils/log-helper');

var _package = require('../../../package.json');

var _package2 = _interopRequireDefault(_package);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('persistence', () => {
  describe('-> istantiation', () => {
    it('should be possible', () => {
      const cache = (0, _4.default)({ log: _logHelper.dummyLog });
      cache.use((0, _2.default)((0, _mockRedisFactory.mockRedisFactory)(), { bootload: false }));
      (0, _expect2.default)(cache).to.be.an(Object);
    });
  });

  describe('debug', () => {
    it('should print a debug of the cache with extra options', () => {
      // more thorough testing of debug in debug.spec.js
      const cache = (0, _4.default)({ initial: { hello: 'world' } });
      cache.use((0, _2.default)((0, _mockRedisFactory.mockRedisFactory)(), { bootload: false }));
      const info = cache.debug({ extraData: 'values' });
      (0, _expect2.default)(info.extraData).to.equal('values');
    });
  });

  describe('-> bootload', () => {
    it('should set TTL based on elapsed time', () => {
      const now = Date.now();
      const diff = 10;
      const loadObjectsStub = _sinon2.default.stub(utils, 'loadObjects').resolves({
        [`${_package2.default.name}-myCache-house/1`]: (0, _cacheHelpers.createEntry)({ hello: 'world' }, 1000, now)
      });
      const cache = (0, _4.default)({ log: _logHelper.dummyLog });
      let cacheInstance;
      cache.use(ci => {
        cacheInstance = ci;
        return (0, _2.default)((0, _mockRedisFactory.mockRedisFactory)(), { bootload: false })(ci);
      });
      const setStub = _sinon2.default.stub(cacheInstance, 'set').returns('ok');
      return cache.load(now + diff).then(() => {
        (0, _expect2.default)(setStub.called).to.equal(true);
        (0, _expect2.default)(setStub.args[0][0]).to.equal(`${_package2.default.name}-myCache-house/1`);
        (0, _expect2.default)(setStub.args[0][1]).to.eql({ hello: 'world' });
        (0, _expect2.default)(setStub.args[0][2]).to.equal(1000 - diff);
        setStub.restore();
        loadObjectsStub.restore();
      });
    });
  });

  describe('-> get (write to redis on MISS)', () => {
    let cache;
    let mockFactory;
    let setSpy;

    beforeEach(() => {
      setSpy = _sinon2.default.spy((key, json, ex, ttl, cb) => {
        if (key.indexOf('setFail') > -1) {
          return cb(new Error('dummyerror'), null);
        }
        cb(null, 'ok');
      });
      _sinon2.default.stub(utils, 'loadObjects').resolves({
        [`${_package2.default.name}-myCache-house/1`]: (0, _cacheHelpers.createEntry)({ hello: 'world' }, 1000)
      });
      mockFactory = (0, _mockRedisFactory.mockRedisFactory)({
        set: setSpy
      });
      cache = (0, _4.default)({ log: _logHelper.dummyLog });
      cache.use((0, _2.default)(mockFactory, {
        doNotPersist: /store/,
        keySpace: 'myCache',
        grace: 1000
      }));
    });

    afterEach(() => {
      cache.destroy();
      utils.loadObjects.restore();
    });

    it('should write to redis when a cache miss occurs', () => {
      const spy = _sinon2.default.spy(() => Promise.resolve('hei'));
      const now = Date.now();
      const key = `key${now}`;
      return cache.get(key, { ttl: 1000, worker: spy }).then(obj => {
        (0, _expect2.default)(spy.called).to.equal(true);
        (0, _expect2.default)(obj.value).to.equal('hei');
        (0, _expect2.default)(obj.cache).to.equal('miss');
        const [[redisKey, json, ex, expire]] = setSpy.args;
        const parsed = JSON.parse(json);
        (0, _expect2.default)(redisKey).to.contain(key);
        (0, _expect2.default)(parsed).to.have.keys(['created', 'TTL', 'value', 'cache']);
        (0, _expect2.default)(ex).to.equal('ex');
        (0, _expect2.default)(expire).to.equal(2);
        (0, _expect2.default)(parsed.value).to.equal('hei');
      });
    });

    it('should log a warning when write to redis fails (on cache miss)', () => {
      const spy = _sinon2.default.spy(() => Promise.resolve('hei'));
      const key = 'setFail';
      const callCount = _logHelper.dummyLog.warn.callCount;
      return cache.get(key, { ttl: 1000, worker: spy }).then(obj => {
        (0, _expect2.default)(spy.called).to.equal(true);
        (0, _expect2.default)(obj.value).to.equal('hei');
        (0, _expect2.default)(obj.cache).to.equal('miss');
        const [[redisKey, json, ex, expire]] = setSpy.args;
        const parsed = JSON.parse(json);
        (0, _expect2.default)(redisKey).to.contain(key);
        (0, _expect2.default)(parsed).to.have.keys(['created', 'TTL', 'value', 'cache']);
        (0, _expect2.default)(ex).to.equal('ex');
        (0, _expect2.default)(expire).to.equal(2);
        (0, _expect2.default)(parsed.value).to.equal('hei');
        (0, _expect2.default)(_logHelper.dummyLog.warn.callCount).to.equal(callCount + 1);
      });
    });

    it('should not write to redis when a cache miss occurs and key matches ignored keys', () => {
      const spy = _sinon2.default.spy(() => Promise.resolve('hei'));
      const now = Date.now();
      const key = `/store/${now}`;
      return cache.get(key, { worker: spy }).then(obj => {
        (0, _expect2.default)(spy.called).to.equal(true);
        (0, _expect2.default)(obj.value).to.equal('hei');
        (0, _expect2.default)(obj.cache).to.equal('miss');
        (0, _expect2.default)(setSpy.called).to.equal(false);
      });
    });
  });

  describe('onDispose', () => {
    let delSpy;
    let setSpy;
    let mockFactory;
    let cache;

    beforeEach(() => {
      delSpy = _sinon2.default.spy((key, cb) => {
        if (key.indexOf('house/1') > -1) {
          return cb(null, 'ok');
        }
        cb(new Error('dummyerror'), null);
      });
      setSpy = _sinon2.default.spy(() => {});
      mockFactory = (0, _mockRedisFactory.mockRedisFactory)({
        del: delSpy,
        set: setSpy
      });
      cache = (0, _4.default)({ log: _logHelper.dummyLog, maxLength: 2 });
      cache.use((0, _2.default)(mockFactory, {
        doNotPersist: /store/,
        bootload: false,
        keySpace: 'myCache',
        grace: 1000
      }));
    });

    afterEach(() => {
      cache.destroy();
    });

    it('should evict key from redis when lru cache evicts key', () => {
      cache.set('house/1', { hei: 'verden' });
      cache.set('house/2', { hei: 'verden' });
      cache.set('guest/3', { hei: 'verden' });
      (0, _expect2.default)(setSpy.callCount).to.equal(3);
      (0, _expect2.default)(setSpy.args[0][0]).to.equal(utils.getRedisKey(`${_package2.default.name}-myCache`, 'house/1'));
      (0, _expect2.default)(setSpy.args[1][0]).to.equal(utils.getRedisKey(`${_package2.default.name}-myCache`, 'house/2'));
      (0, _expect2.default)(setSpy.args[2][0]).to.equal(utils.getRedisKey(`${_package2.default.name}-myCache`, 'guest/3'));
      (0, _expect2.default)(delSpy.called).to.equal(true);
      (0, _expect2.default)(delSpy.args[0][0]).to.equal(utils.getRedisKey(`${_package2.default.name}-myCache`, 'house/1'));
    });

    it('should catch error in redis.del when lru cache evicts key', done => {
      const count = _logHelper.dummyLog.error.callCount;
      cache.set('guest/3', { hei: 'verden' });
      cache.set('house/1', { hei: 'verden' });
      cache.set('house/2', { hei: 'verden' });
      (0, _expect2.default)(setSpy.callCount).to.equal(3);
      (0, _expect2.default)(setSpy.args[0][0]).to.equal(utils.getRedisKey(`${_package2.default.name}-myCache`, 'guest/3'));
      (0, _expect2.default)(setSpy.args[1][0]).to.equal(utils.getRedisKey(`${_package2.default.name}-myCache`, 'house/1'));
      (0, _expect2.default)(setSpy.args[2][0]).to.equal(utils.getRedisKey(`${_package2.default.name}-myCache`, 'house/2'));
      (0, _expect2.default)(delSpy.called).to.equal(true);
      (0, _expect2.default)(delSpy.args[0][0]).to.equal(utils.getRedisKey(`${_package2.default.name}-myCache`, 'guest/3'));
      setTimeout(() => {
        (0, _expect2.default)(_logHelper.dummyLog.error.callCount).to.equal(count + 1);
        done();
      });
    });
  });

  describe('-> del/clear', () => {
    let delSpy;
    let cache;

    beforeEach(() => {
      delSpy = _sinon2.default.spy((key, cb) => {
        if (key.indexOf('house/1') > -1) {
          return cb(null, 'ok');
        }
        cb(new Error('dummyerror'), null);
      });
      cache = (0, _4.default)({ log: _logHelper.dummyLog });
      cache.use((0, _2.default)((0, _mockRedisFactory.mockRedisFactory)({ del: delSpy }), { bootload: false }));
    });

    it('should delete key from redis when a key is deleted from lru-cache', () => {
      return cache.del('house/1').then(() => {
        (0, _expect2.default)(delSpy.called).to.equal(true);
      });
    });

    it('should throw an error key from redis when a key is deleted from lru-cache', () => {
      return cache.del('key').catch(() => {
        (0, _expect2.default)(delSpy.called).to.equal(true);
      });
    });

    it('should delete all keys in redis with prefix', () => {
      _sinon2.default.stub(utils, 'deleteKeys').resolves();
      return cache.clear().then(() => {
        (0, _expect2.default)(utils.deleteKeys.called).to.equal(true);
        (0, _expect2.default)(utils.deleteKeys.args[0][0]).to.equal(`${_package2.default.name}-`);
        utils.deleteKeys.restore();
      });
    });
  });
});