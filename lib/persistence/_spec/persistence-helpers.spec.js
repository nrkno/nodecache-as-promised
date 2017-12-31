'use strict';

var _persistenceHelpers = require('../persistence-helpers');

var _mockRedisFactory = require('../../utils/mock-redis-factory');

var _logHelper = require('../../utils/log-helper');

var _sinon = require('sinon');

var _sinon2 = _interopRequireDefault(_sinon);

var _expect = require('expect.js');

var _expect2 = _interopRequireDefault(_expect);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const parsedCache = {
  'asdf-123': { hello: 'world1' },
  'asdf-345': { hello: 'world2' },
  'asdf-100': { hello: 'world3' }
};

const redisCache = Object.keys(parsedCache).reduce((acc, key) => {
  acc[key] = JSON.stringify(parsedCache[key]);
  return acc;
}, {});

describe('persistence-helpers', () => {
  describe('-> getRedisKey', () => {
    it('generate key', () => {
      const key = (0, _persistenceHelpers.getRedisKey)('prefix', 'key');
      (0, _expect2.default)(key).to.equal('prefix-key');
    });
  });

  describe('-> extractKeyFromRedis', () => {
    it('should match keys', () => {
      const key = (0, _persistenceHelpers.extractKeyFromRedis)('prefix-http://localhost:8080', 'prefix-http://localhost:8080-myKey');
      (0, _expect2.default)(key).to.equal('myKey');
    });
  });

  describe('-> loadObjects', () => {
    let redisClient;
    let mgetSpy;

    it('should load keys', () => {
      const events = {};
      setTimeout(() => {
        events.data[0](['test-localhost8080-myKey']);
        events.end[0]();
      }, 20);
      mgetSpy = _sinon2.default.spy((keysToRead, cb) => {
        cb(null, [JSON.stringify({ hei: 'verden' })]);
      });
      redisClient = (0, _mockRedisFactory.mockRedisFactory)({ mget: mgetSpy }, { events })();
      return (0, _persistenceHelpers.loadObjects)('test-localhost8080', redisClient, _logHelper.dummyLog).then(results => {
        (0, _expect2.default)(results).to.eql({
          'test-localhost8080-myKey': {
            hei: 'verden'
          }
        });
      });
    });

    it('should handle errors when loading keys', () => {
      const events = {};
      setTimeout(() => {
        events.error[0](new Error('dummyerror'));
      }, 100);
      redisClient = (0, _mockRedisFactory.mockRedisFactory)({}, { events })();
      return (0, _persistenceHelpers.loadObjects)('test-localhost8080', redisClient, _logHelper.dummyLog).catch(err => {
        (0, _expect2.default)(err.message).to.equal('dummyerror');
      });
    });
  });

  describe('-> deleteKey', () => {
    let redisClient;
    let delSpy;

    it('should delete keys', () => {
      const p = (key, cb) => cb(null, 'ok');
      delSpy = _sinon2.default.spy(p);
      redisClient = (0, _mockRedisFactory.mockRedisFactory)({ del: delSpy })();
      return (0, _persistenceHelpers.deleteKey)('testkey', redisClient, _logHelper.dummyLog).then(result => {
        (0, _expect2.default)(delSpy.called).to.equal(true);
        (0, _expect2.default)(result).to.equal('ok');
      });
    });

    it('should reject if an error occurrs keys', () => {
      const p = (key, cb) => cb(new Error('not ok'), null);
      delSpy = _sinon2.default.spy(p);
      redisClient = (0, _mockRedisFactory.mockRedisFactory)({ del: delSpy })();
      return (0, _persistenceHelpers.deleteKey)('testkey', redisClient, _logHelper.dummyLog).catch(err => {
        (0, _expect2.default)(delSpy.called).to.equal(true);
        (0, _expect2.default)(err).to.be.an(Error);
      });
    });
  });

  describe('-> deleteKeys', () => {
    it('should delete all keys with prefix from redis', () => {
      const delSpy = _sinon2.default.spy((key, cb) => cb(null, 'ok'));
      const events = {};
      setTimeout(() => {
        events.data[0](['test-localhost8080-myKey']);
        events.end[0]();
      }, 100);
      const mgetSpy = _sinon2.default.spy((keysToRead, cb) => {
        cb(null, [JSON.stringify({ hei: 'verden' })]);
      });
      const redisClient = (0, _mockRedisFactory.mockRedisFactory)({ del: delSpy, mget: mgetSpy }, { events })();
      return (0, _persistenceHelpers.deleteKeys)('asdf', redisClient).then((...args) => {
        (0, _expect2.default)(delSpy.called).to.equal(true);
      });
    });
  });

  describe('-> readKeys', () => {
    let redisClient;
    let mgetSpy;

    it('should read multiple keys', () => {
      const values = Object.keys(redisCache).map(key => redisCache[key]);
      mgetSpy = _sinon2.default.spy((keys, cb) => cb(null, values));
      redisClient = (0, _mockRedisFactory.mockRedisFactory)({ mget: mgetSpy })();
      return (0, _persistenceHelpers.readKeys)(Object.keys(redisCache), redisClient, _logHelper.dummyLog).then(result => {
        (0, _expect2.default)(mgetSpy.called).to.equal(true);
        (0, _expect2.default)(result).to.eql(parsedCache);
      });
    });

    it('should resolve empty when no keys match', () => {
      const p = (keys, cb) => cb(null, []);
      mgetSpy = _sinon2.default.spy(p);
      redisClient = (0, _mockRedisFactory.mockRedisFactory)({ mget: mgetSpy })();
      return (0, _persistenceHelpers.readKeys)(Object.keys([]), redisClient, _logHelper.dummyLog).then(result => {
        (0, _expect2.default)(mgetSpy.called).to.equal(false);
        (0, _expect2.default)(result).to.eql({});
      });
    });

    it('should skip keys with invalid json', () => {
      const p = (keys, cb) => cb(null, ['{1}', '{"hello": "world"}']);
      mgetSpy = _sinon2.default.spy(p);
      redisClient = (0, _mockRedisFactory.mockRedisFactory)({ mget: mgetSpy })();
      return (0, _persistenceHelpers.readKeys)(['key1', 'key2'], redisClient, _logHelper.dummyLog).then(result => {
        (0, _expect2.default)(mgetSpy.called).to.equal(true);
        (0, _expect2.default)(result).to.eql({ key2: { hello: 'world' } });
      });
    });

    it('should reject when an error occurrs', () => {
      const p = (keys, cb) => cb(new Error('not ok'), null);
      mgetSpy = _sinon2.default.spy(p);
      redisClient = (0, _mockRedisFactory.mockRedisFactory)({ mget: mgetSpy })();
      return (0, _persistenceHelpers.readKeys)(Object.keys(redisCache), redisClient, _logHelper.dummyLog).catch(err => {
        (0, _expect2.default)(mgetSpy.called).to.equal(true);
        (0, _expect2.default)(err).to.be.an(Error);
      });
    });
  });

  describe('isSerializable', () => {
    it('should return true for plain objects', () => {
      const obj = {
        str: 'string',
        arr: [1, '2', 1 / 2],
        obj: {
          1: 2,
          3: 4
        }
      };
      (0, _expect2.default)((0, _persistenceHelpers.isSerializable)(obj)).to.equal(true);
    });

    it('should return false for objects with functions', () => {
      const obj = {
        func: () => {}
      };
      (0, _expect2.default)((0, _persistenceHelpers.isSerializable)(obj)).to.equal(false);
    });

    it('should return false for objects with built in native objects', () => {
      const obj = {
        re: /123/,
        date: new Date()
      };
      (0, _expect2.default)((0, _persistenceHelpers.isSerializable)(obj)).to.equal(false);
    });
  });
});