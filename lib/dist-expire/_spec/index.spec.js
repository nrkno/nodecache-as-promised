'use strict';

var _ = require('../');

var _2 = _interopRequireDefault(_);

var _3 = require('../..');

var _4 = _interopRequireDefault(_3);

var _sinon = require('sinon');

var _sinon2 = _interopRequireDefault(_sinon);

var _expect = require('expect.js');

var _expect2 = _interopRequireDefault(_expect);

var _mockRedisFactory = require('../../utils/mock-redis-factory');

var _logHelper = require('../../utils/log-helper');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const namespace = 'desketoy8080';

describe('dist-expire', () => {
  describe('-> istantiation', () => {
    it('should be possible', () => {
      const cache = (0, _4.default)({ log: _logHelper.dummyLog });
      cache.use((0, _2.default)((0, _mockRedisFactory.mockRedisFactory)(), namespace));
      (0, _expect2.default)(cache).to.be.an(Object);
    });
  });

  describe('debug', () => {
    it('should print a debug of the cache with extra options', () => {
      // more thorough testing of debug in debug.spec.js
      const cache = (0, _4.default)({ initial: { hello: 'world' } });
      cache.use((0, _2.default)((0, _mockRedisFactory.mockRedisFactory)(), namespace));
      const info = cache.debug({ extraData: 'values' });
      (0, _expect2.default)(info.extraData).to.equal('values');
    });
  });

  describe('-> inheritance', () => {
    it('should be able to use methods from extended class (using middleware)', () => {
      const cache = (0, _4.default)({ log: _logHelper.dummyLog });
      cache.use((0, _2.default)((0, _mockRedisFactory.mockRedisFactory)(), namespace));
      const p = () => Promise.resolve();
      const spy = _sinon2.default.spy(p);
      cache.set('hello', 'world');
      return cache.get('hello', { worker: spy }).then(obj => {
        (0, _expect2.default)(obj.value).to.equal('world');
        (0, _expect2.default)(spy.called).to.equal(false);
      });
    });
  });

  describe('-> distributed expire', () => {
    it('should expire content on expire', () => {
      const spy = _sinon2.default.spy(() => Promise.resolve('world2'));
      const cache = (0, _4.default)({ initial: { hello: 'world' }, log: _logHelper.dummyLog });
      cache.use((0, _2.default)((0, _mockRedisFactory.mockRedisFactory)(), namespace));
      cache.expire(['hello']);
      (0, _expect2.default)(cache.get('hello').TTL).to.equal(0);
      return cache.get('hello', { worker: spy }).then(obj => {
        (0, _expect2.default)(obj.value).to.equal('world2');
        (0, _expect2.default)(spy.called).to.equal(true);
      });
    });

    it('should handle errors if data is non-parsable', () => {
      const cbs = [];
      const on = (event, cb) => cbs.push(cb);
      const onSpy = _sinon2.default.spy(on);
      const pub = (ns, data) => {
        cbs.forEach(cb => cb(ns, data));
      };
      const sub = (ns, cb) => {
        if (ns === namespace) {
          return cb(null, 'ok');
        }
        return cb(new Error('dummyerror'), null);
      };
      const publishSpy = _sinon2.default.spy(pub);
      const subscribeSpy = _sinon2.default.spy(sub);
      const cache = (0, _4.default)({ initial: { hello: 'world' }, log: _logHelper.dummyLog });
      const callCount = _logHelper.dummyLog.error.callCount;
      cache.use((0, _2.default)((0, _mockRedisFactory.mockRedisFactory)({
        on: onSpy,
        publish: publishSpy,
        subscribe: subscribeSpy
      }), namespace));
      pub('asdf', '{');
      (0, _expect2.default)(_logHelper.dummyLog.error.callCount).to.equal(callCount + 1);
      const cache2 = (0, _4.default)({ initial: { hello: 'world' }, log: _logHelper.dummyLog });
      cache2.use((0, _2.default)((0, _mockRedisFactory.mockRedisFactory)({
        on: onSpy,
        publish: publishSpy,
        subscribe: subscribeSpy
      }), 'dummy'));
      (0, _expect2.default)(_logHelper.dummyLog.error.callCount).to.equal(callCount + 2);
    });
  });
});
//# sourceMappingURL=index.spec.js.map