'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /* eslint max-nested-callbacks: 0 */


var _ = require('../');

var _2 = _interopRequireDefault(_);

var _expect = require('expect.js');

var _expect2 = _interopRequireDefault(_expect);

var _sinon = require('sinon');

var _sinon2 = _interopRequireDefault(_sinon);

var _logHelper = require('../utils/log-helper');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

const dummyKey = 'hei/verden';
const cacheValue = {
  keyNamespace: 'valueAsString'
};
const preCached = {
  [dummyKey]: cacheValue
};

describe('CacheManager', () => {
  describe('instantation', () => {
    it('should create a new empty instance', () => {
      const cacheInstance = (0, _2.default)({}, {});
      (0, _expect2.default)(cacheInstance).to.be.a(Object);
      const info = cacheInstance.debug();
      (0, _expect2.default)(info.itemCount).to.equal(0);
    });

    it('should have exported plugins', () => {
      (0, _expect2.default)(_.distCache).to.be.a('function');
      (0, _expect2.default)(_.persistentCache).to.be.a('function');
    });

    it('should create a new prefilled instance with a cloned copy', () => {
      const obj = { hei: 'verden' };
      const cacheInstance = (0, _2.default)({ initial: obj });
      obj.hei = 'world';
      (0, _expect2.default)(cacheInstance).to.be.a(Object);
      const info = cacheInstance.debug();
      (0, _expect2.default)(info.itemCount).to.equal(1);
      (0, _expect2.default)(cacheInstance.get('hei').value).to.equal('verden');
      (0, _expect2.default)(cacheInstance.get('hei').cache).to.equal('hit');
    });
  });

  describe('debug', () => {
    it('should print a debug of the cache with extra options', () => {
      // more thorough testing of debug in debug.spec.js
      const cacheInstance = (0, _2.default)({ initial: { hello: 'world' } });
      const info = cacheInstance.debug({ extraData: 'values' });
      (0, _expect2.default)(info.extraData).to.equal('values');
    });
  });

  describe('-> hot cache', () => {
    let cacheInstance;
    let spy;

    beforeEach(() => {
      cacheInstance = (0, _2.default)({ initial: preCached });
      const p = () => Promise.resolve();
      spy = _sinon2.default.spy(p);
    });

    it('should return cached content if not stale', () => {
      return cacheInstance.get(dummyKey, { worker: spy }).then(obj => {
        (0, _expect2.default)(obj.value).to.eql(cacheValue);
        (0, _expect2.default)(obj.cache).to.equal('hit');
        (0, _expect2.default)(spy.called).to.equal(false);
      });
    });
  });

  describe('-> has/del/clear', () => {
    let cacheInstance;

    beforeEach(() => {
      cacheInstance = (0, _2.default)({ initial: preCached });
    });

    it('should return true if key exists in cache', () => {
      cacheInstance.set('key', 'value');
      (0, _expect2.default)(cacheInstance.has('key')).to.equal(true);
    });

    it('should return false if key is not in cache', () => {
      (0, _expect2.default)(cacheInstance.has('key')).to.equal(false);
    });

    it('should return false if key was deleted from cache', () => {
      cacheInstance.set('key', 'value');
      cacheInstance.del('key');
      (0, _expect2.default)(cacheInstance.has('key')).to.equal(false);
    });

    it('should return false if key was deleted from cache', () => {
      cacheInstance.set('key1', 'value');
      cacheInstance.set('key2', 'value');
      cacheInstance.clear();
      (0, _expect2.default)(cacheInstance.has('key1')).to.equal(false);
      (0, _expect2.default)(cacheInstance.has('key2')).to.equal(false);
    });
  });

  describe('-> cold/stale cache', () => {
    let cacheInstance;
    let spy;
    let now;

    beforeEach(() => {
      cacheInstance = (0, _2.default)({ initial: preCached });
      cacheInstance.set(dummyKey, cacheInstance.get(dummyKey).value, -1000);
      now = Date.now();
      spy = _sinon2.default.spy(() => new Promise(resolve => {
        setTimeout(() => resolve(now), 10);
      }));
    });

    it('should return promised content when key is not present', () => {
      return cacheInstance.get('N/A', { worker: spy }).then(obj => {
        (0, _expect2.default)(obj.value).to.eql(now);
        (0, _expect2.default)(obj.cache).to.equal('miss');
        (0, _expect2.default)(spy.called).to.equal(true);
      });
    });

    it('should return synchronous get when no worker is given', () => {
      // miss
      const obj = cacheInstance.get('N/A');
      (0, _expect2.default)(obj).to.equal(null);
      // stale
      const obj2 = cacheInstance.get(dummyKey);
      (0, _expect2.default)(obj2.value).to.eql(cacheValue);
      (0, _expect2.default)(obj2.cache).to.equal('stale');
      // hot
      cacheInstance.set('hello', { yoman: 'world' });
      const obj3 = cacheInstance.get('hello');
      (0, _expect2.default)(obj3.value).to.eql({ yoman: 'world' });
      (0, _expect2.default)(obj3.cache).to.equal('hit');
    });

    it('should return promised content if cache is stale', () => {
      return cacheInstance.get(dummyKey, { worker: spy }).then(obj => {
        (0, _expect2.default)(obj.value).to.eql(now);
        (0, _expect2.default)(obj.cache).to.equal('miss');
        (0, _expect2.default)(spy.called).to.equal(true);
      });
    });
  });

  describe('-> worker queue', () => {
    let cacheInstance;
    let spy;
    let now;

    beforeEach(() => {
      cacheInstance = (0, _2.default)({ initial: preCached });
      cacheInstance.set(dummyKey, cacheInstance.get(dummyKey).value, -1000);
      now = Date.now();
      spy = _sinon2.default.spy(() => new Promise(resolve => {
        setTimeout(() => resolve(now), 10);
      }));
    });

    it('should run only one promise, while two requests asks for data from cold cache concurrently', () => {
      return Promise.all([cacheInstance.get(dummyKey, { worker: spy }), cacheInstance.get(dummyKey, { worker: spy })]).then(([val1, val2]) => {
        (0, _expect2.default)(val1.value).to.eql(val2.value);
        (0, _expect2.default)(spy.callCount).to.equal(1);
        (0, _expect2.default)(val1.cache).to.equal('miss');
        (0, _expect2.default)(val2.cache).to.equal('hit');
      });
    });
  });

  describe('-> error handling (timeouts)', () => {
    let cacheInstance;

    beforeEach(() => {
      cacheInstance = (0, _2.default)({ initial: preCached, log: _logHelper.dummyLog });
      cacheInstance.set(dummyKey, cacheInstance.get(dummyKey).value, -1000);
    });

    it('should return stale cache and increase wait if promise reaches timeout', () => {
      const timeoutSpy = _sinon2.default.spy(() => new Promise(resolve => {
        setTimeout(() => resolve('another object'), 1000);
      }));
      const info = cacheInstance.debug();
      (0, _expect2.default)(info.waiting.get(dummyKey)).to.be.a('undefined');
      return cacheInstance.get(dummyKey, { workerTimeout: 0, worker: timeoutSpy }).then(obj => {
        (0, _expect2.default)(timeoutSpy.called).to.equal(true);
        (0, _expect2.default)(info.waiting.get(dummyKey)).not.to.equal(0);
        (0, _expect2.default)(obj.value).to.eql(cacheValue);
        (0, _expect2.default)(obj.cache).to.equal('stale');
      });
    });

    it('should reject if cache is cold and a timeout occurs', () => {
      const timeoutSpy = _sinon2.default.spy(() => new Promise(resolve => {
        setTimeout(() => resolve('another object'), 1000);
      }));
      return cacheInstance.get(dummyKey, { workerTimeout: 0, worker: timeoutSpy }).catch(err => {
        (0, _expect2.default)(timeoutSpy.called).to.equal(true);
        (0, _expect2.default)(err).to.be.an(Error);
      });
    });

    it('should re-run promise after deltaWait time has passed', done => {
      const timeoutSpy = _sinon2.default.spy(() => new Promise(resolve => {
        setTimeout(() => resolve('another object'), 1000);
      }));
      const resolveSpy = _sinon2.default.spy(() => Promise.resolve('hei verden'));
      const conf = {
        deltaWait: 10,
        workerTimeout: 10
      };
      cacheInstance.get(dummyKey, _extends({}, conf, { worker: timeoutSpy })).then(obj => {
        // 1. should return stale cache when timeout occurs
        (0, _expect2.default)(obj.value).to.eql(cacheValue);
        const info = cacheInstance.debug();
        (0, _expect2.default)(info.waiting.get(dummyKey).wait).to.equal(10);
        return cacheInstance.get(dummyKey, _extends({}, conf, { worker: resolveSpy })).then(obj => {
          // 2. should return stale cache before wait period has finished
          (0, _expect2.default)(obj.cache).to.equal('stale');
          (0, _expect2.default)(obj.value).to.eql(cacheValue);
          setTimeout(() => {
            return cacheInstance.get(dummyKey, _extends({}, conf, { worker: resolveSpy })).then(obj => {
              // 3. should return fresh data when wait period has finished
              (0, _expect2.default)(obj.value).to.eql('hei verden');
              (0, _expect2.default)(obj.cache).to.equal('miss');
              done();
            });
          }, 10);
        });
      }).catch(done);
    });
  });

  describe('-> error handling (rejections)', () => {
    let cacheInstance;

    beforeEach(() => {
      cacheInstance = (0, _2.default)({ initial: preCached, log: _logHelper.dummyLog });
      cacheInstance.set(dummyKey, cacheInstance.get(dummyKey).value, -1000);
    });

    it('should return stale cache and set wait if a promise rejection occurs', () => {
      const rejectionSpy = _sinon2.default.spy(() => Promise.reject(new Error('an error occurred')));
      const info = cacheInstance.debug();
      (0, _expect2.default)(info.waiting.get(dummyKey)).to.be.a('undefined');
      return cacheInstance.get(dummyKey, { worker: rejectionSpy }).then(obj => {
        (0, _expect2.default)(rejectionSpy.called).to.equal(true);
        (0, _expect2.default)(info.waiting.get(dummyKey)).not.to.equal(0);
        (0, _expect2.default)(obj.value).to.eql(cacheValue);
        (0, _expect2.default)(obj.cache).to.equal('stale');
      });
    });

    it('should reject if cache is cold and a rejection occurs', () => {
      const rejectionSpy = _sinon2.default.spy(() => Promise.reject(new Error('an error occurred')));
      return cacheInstance.get(dummyKey, { worker: rejectionSpy }).catch(err => {
        (0, _expect2.default)(rejectionSpy.called).to.equal(true);
        (0, _expect2.default)(err).to.be.an(Error);
      });
    });

    it('should reject if an Error is thrown', () => {
      const rejectionSpy = _sinon2.default.spy(() => {
        throw new Error('an error occurred');
      });
      return cacheInstance.get(dummyKey, { worker: rejectionSpy }).catch(err => {
        (0, _expect2.default)(rejectionSpy.called).to.equal(true);
        (0, _expect2.default)(err).to.be.an(Error);
      });
    });

    it('should re-run promise after deltaWait time has passed (when failing caused by a rejection)', done => {
      const rejectionSpy = _sinon2.default.spy(() => Promise.reject(new Error('')));
      const resolveSpy = _sinon2.default.spy(() => Promise.resolve('hei verden'));
      const conf = {
        deltaWait: 10
      };
      cacheInstance.get(dummyKey, _extends({}, conf, { worker: rejectionSpy })).then(obj => {
        // 1. should return stale cache when rejection occurs
        (0, _expect2.default)(obj.value).to.eql(cacheValue);
        return cacheInstance.get(dummyKey, _extends({}, conf, { worker: resolveSpy })).then(obj => {
          // 2. should return stale cache before wait period has finished
          (0, _expect2.default)(obj.value).to.eql(cacheValue);
          (0, _expect2.default)(obj.cache).to.equal('stale');
          setTimeout(() => {
            return cacheInstance.get(dummyKey, _extends({}, conf, { worker: resolveSpy })).then(obj => {
              // 3. should return fresh data when wait period has finished
              (0, _expect2.default)(obj.value).to.eql('hei verden');
              (0, _expect2.default)(obj.cache).to.equal('miss');
              done();
            });
          }, 10);
        });
      }).catch(done);
    });

    it('should re-run promise after deltaWait time has passed (when failing caused by a rejection and cache is cold)', done => {
      const rejectionSpy = _sinon2.default.spy(() => Promise.reject(new Error('')));
      const conf = {
        deltaWait: 10
      };
      cacheInstance.get('N/A', _extends({}, conf, { worker: rejectionSpy })).catch(err => {
        (0, _expect2.default)(err).to.be.an(Error);
        (0, _expect2.default)(rejectionSpy.callCount).to.equal(1);
        cacheInstance.get('N/A', _extends({}, conf, { worker: rejectionSpy })).catch(err => {
          (0, _expect2.default)(err).to.be.an(Error);
          (0, _expect2.default)(rejectionSpy.callCount).to.equal(1);
          cacheInstance.set('N/A', 'hei verden');
          const info = cacheInstance.debug();
          info.waiting.delete('N/A');
          setTimeout(() => {
            return cacheInstance.get('N/A', _extends({}, conf, { worker: rejectionSpy })).then(obj => {
              (0, _expect2.default)(rejectionSpy.callCount).to.equal(1);
              (0, _expect2.default)(obj.value).to.eql('hei verden');
              (0, _expect2.default)(obj.cache).to.equal('hit');
              done();
            });
          }, 10);
        });
      }).catch(done);
    });

    it('should increase deltaWait after several re-runs', done => {
      const rejectionSpy = _sinon2.default.spy(() => Promise.reject(new Error('')));
      const conf = {
        deltaWait: 10
      };
      const info = cacheInstance.debug();
      (0, _expect2.default)(info.waiting.get('N/A')).to.be.a('undefined');
      cacheInstance.get('N/A', _extends({}, conf, { worker: rejectionSpy })).catch(err => {
        (0, _expect2.default)(err).to.be.an(Error);
        (0, _expect2.default)(rejectionSpy.callCount).to.equal(1);
        (0, _expect2.default)(info.waiting.get('N/A').wait).to.equal(10);
        const { started } = info.waiting.get('N/A');
        cacheInstance.get('N/A', _extends({}, conf, { worker: rejectionSpy })).catch(err => {
          (0, _expect2.default)(err).to.be.an(Error);
          (0, _expect2.default)(rejectionSpy.callCount).to.equal(1);
          (0, _expect2.default)(info.waiting.get('N/A')).to.eql({
            started,
            wait: 10,
            waitUntil: started + 10
          });
          setTimeout(() => {
            return cacheInstance.get('N/A', _extends({}, conf, { worker: rejectionSpy })).catch(err => {
              (0, _expect2.default)(err).to.be.an(Error);
              (0, _expect2.default)(rejectionSpy.callCount).to.equal(2);
              (0, _expect2.default)(info.waiting.get('N/A').wait).to.equal(10);
              (0, _expect2.default)(info.waiting.get('N/A').started).not.to.equal(started);
              done();
            });
          }, 10);
        });
      }).catch(done);
    });
  });

  describe('-> keys/values/entries', () => {
    let cacheInstance;

    beforeEach(() => {
      cacheInstance = (0, _2.default)({ initial: {
          'house/1': { hei: 'verden1' },
          'house/2': { hei: 'verden2' },
          'guest/2': { hei: 'verden3' }
        } });
    });

    it('should return keys', () => {
      (0, _expect2.default)(cacheInstance.keys()).to.eql(['house/1', 'house/2', 'guest/2'].reverse());
    });

    it('should return values', () => {
      (0, _expect2.default)(cacheInstance.values().map(({ value }) => value)).to.eql([{ hei: 'verden3' }, { hei: 'verden2' }, { hei: 'verden1' }]);
    });

    it('should return entries', () => {
      (0, _expect2.default)(Array.from(cacheInstance.entries()).map(([key, { value }]) => {
        return { [key]: value };
      })).to.eql([{ 'guest/2': { hei: 'verden3' } }, { 'house/2': { hei: 'verden2' } }, { 'house/1': { hei: 'verden1' } }]);
    });
  });

  describe('-> expire', () => {
    let cacheInstance;

    beforeEach(() => {
      cacheInstance = (0, _2.default)({ initial: {
          'house/1': { hei: 'verden' },
          'house/2': { hei: 'verden' },
          'guest/2': { hei: 'verden' }
        } });
    });

    it('should expire all house keys', () => {
      cacheInstance.expire(['house/*']);
      (0, _expect2.default)(cacheInstance.get('house/1').TTL).to.equal(0);
      (0, _expect2.default)(cacheInstance.get('house/2').TTL).to.equal(0);
      (0, _expect2.default)(cacheInstance.get('guest/2').TTL).not.to.equal(0);
    });

    it('should expire given house keys', () => {
      cacheInstance.expire(['house/*', 'guest/2']);
      (0, _expect2.default)(cacheInstance.get('house/1').TTL).to.equal(0);
      (0, _expect2.default)(cacheInstance.get('house/2').TTL).to.equal(0);
      (0, _expect2.default)(cacheInstance.get('guest/2').TTL).to.equal(0);
    });
  });

  describe('-> LRU capabilities', () => {
    it('should throw away first entered entry on inital state', () => {
      const cacheInstance = (0, _2.default)({
        initial: {
          'house/1': { hei: 'verden' },
          'house/2': { hei: 'verden' },
          'guest/3': { hei: 'verden' }
        },
        maxLength: 2
      });
      const info = cacheInstance.debug();
      (0, _expect2.default)(info.itemCount).to.equal(2);
      (0, _expect2.default)(cacheInstance.keys()).to.eql(['guest/3', 'house/2']);
    });

    it('should call dispose on set operations when LRU cache evicts object', () => {
      const cacheInstance = (0, _2.default)({ maxLength: 2 });
      const spy = _sinon2.default.spy();
      cacheInstance.addDisposer(spy);
      cacheInstance.set('house/1', { hei: 'verden' });
      cacheInstance.set('house/2', { hei: 'verden' });
      cacheInstance.set('guest/3', { hei: 'verden' });
      (0, _expect2.default)(spy.called).to.equal(true);
      const key = spy.args[0][0];
      const _spy$args$0$ = spy.args[0][1],
            { created } = _spy$args$0$,
            callArgs = _objectWithoutProperties(_spy$args$0$, ['created']);
      (0, _expect2.default)(key).to.equal('house/1');
      (0, _expect2.default)(callArgs).to.eql({
        TTL: 86400000,
        value: { hei: 'verden' },
        cache: 'hit'
      });
      cacheInstance.removeDisposer(spy);
      cacheInstance.set('guest/4', { hei: 'verden' });
      (0, _expect2.default)(spy.callCount).to.equal(1);
      const info = cacheInstance.debug();
      (0, _expect2.default)(info.itemCount).to.equal(2);
      (0, _expect2.default)(cacheInstance.keys()).to.eql(['guest/4', 'guest/3']);
    });

    it('should call dispose on del operations', () => {
      const cacheInstance = (0, _2.default)({ maxLength: 2 });
      const spy = _sinon2.default.spy();
      cacheInstance.addDisposer(spy);
      cacheInstance.set('house/1', { hei: 'verden' });
      cacheInstance.del('house/1');
      (0, _expect2.default)(spy.called).to.equal(true);
      cacheInstance.removeDisposer(spy);
    });

    it('should call dispose on clear operations', () => {
      const cacheInstance = (0, _2.default)({ maxLength: 2 });
      const spy = _sinon2.default.spy();
      cacheInstance.addDisposer(spy);
      cacheInstance.set('house/1', { hei: 'verden' });
      cacheInstance.clear();
      (0, _expect2.default)(spy.called).to.equal(true);
      cacheInstance.removeDisposer(spy);
    });
  });
});
//# sourceMappingURL=index.spec.js.map