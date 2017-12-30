/* eslint max-nested-callbacks: 0 */
import inMemoryCache, {distCache, persistentCache} from '../'
import expect from 'expect.js'
import sinon from 'sinon'
import {dummyLog} from '../utils/log-helper'

const dummyKey = 'hei/verden'
const cacheValue = {
  keyNamespace: 'valueAsString'
}
const preCached = {
  [dummyKey]: cacheValue
}

describe('CacheManager', () => {
  describe('instantation', () => {
    it('should create a new empty instance', () => {
      const cacheInstance = inMemoryCache({}, {})
      expect(cacheInstance).to.be.a(Object)
      expect(cacheInstance.cache.itemCount).to.equal(0)
    })

    it('should have exported plugins', () => {
      expect(distCache).to.be.a('function')
      expect(persistentCache).to.be.a('function')
    })

    it('should create a new prefilled instance with a cloned copy', () => {
      const obj = {hei: 'verden'}
      const cacheInstance = inMemoryCache({initial: obj})
      obj.hei = 'world'
      expect(cacheInstance).to.be.a(Object)
      expect(cacheInstance.cache.itemCount).to.equal(1)
      expect(cacheInstance.cache.get('hei').value).to.equal('verden')
      expect(cacheInstance.cache.get('hei').cache).to.equal('hit')
    })
  })

  describe('debug', () => {
    it('should print a debug of the cache with extra options', () => {
      // more thorough testing of debug in debug.spec.js
      const cacheInstance = inMemoryCache({initial: {hello: 'world'}})
      const info = cacheInstance.debug({extraData: 'values'})
      expect(info.extraData).to.equal('values')
    })
  })

  describe('-> hot cache', () => {
    let cacheInstance
    let spy

    beforeEach(() => {
      cacheInstance = inMemoryCache({initial: preCached})
      const p = () => Promise.resolve()
      spy = sinon.spy(p)
    })

    it('should return cached content if not stale', () => {
      return cacheInstance.get(dummyKey, {worker: spy}).then((obj) => {
        expect(obj.value).to.eql(cacheValue)
        expect(obj.cache).to.equal('hit')
        expect(spy.called).to.equal(false)
      })
    })
  })

  describe('-> cold/stale cache', () => {
    let cacheInstance
    let spy
    let now

    beforeEach(() => {
      cacheInstance = inMemoryCache({initial: preCached})
      const staleObj = {...cacheInstance.cache.get(dummyKey), TTL: -1000}
      cacheInstance.cache.set(dummyKey, staleObj)
      now = Date.now()
      spy = sinon.spy(() => new Promise((resolve) => {
        setTimeout(() => resolve(now), 10)
      }))
    })

    it('should return promised content when key is not present', () => {
      return cacheInstance.get('N/A', {worker: spy}).then((obj) => {
        expect(obj.value).to.eql(now)
        expect(obj.cache).to.equal('miss')
        expect(spy.called).to.equal(true)
      })
    })

    it('should return synchronous get when no worker is given', () => {
      // miss
      const obj = cacheInstance.get('N/A')
      expect(obj).to.equal(null)
      // stale
      const obj2 = cacheInstance.get(dummyKey)
      expect(obj2.value).to.eql(cacheValue)
      expect(obj2.cache).to.equal('stale')
      // hot
      cacheInstance.set('hello', {yoman: 'world'})
      const obj3 = cacheInstance.get('hello')
      expect(obj3.value).to.eql({yoman: 'world'})
      expect(obj3.cache).to.equal('hit')
    })

    it('should return promised content if cache is stale', () => {
      return cacheInstance.get(dummyKey, {worker: spy}).then((obj) => {
        expect(obj.value).to.eql(now)
        expect(obj.cache).to.equal('miss')
        expect(spy.called).to.equal(true)
      })
    })
  })

  describe('-> worker queue', () => {
    let cacheInstance
    let spy
    let now

    beforeEach(() => {
      cacheInstance = inMemoryCache({initial: preCached})
      const staleObj = {...cacheInstance.cache.get(dummyKey), TTL: -1000}
      cacheInstance.cache.set(dummyKey, staleObj)
      now = Date.now()
      spy = sinon.spy(() => new Promise((resolve) => {
        setTimeout(() => resolve(now), 10)
      }))
    })

    it('should run only one promise, while two requests asks for data from cold cache concurrently', () => {
      return Promise.all([
        cacheInstance.get(dummyKey, {worker: spy}),
        cacheInstance.get(dummyKey, {worker: spy})
      ]).then(([val1, val2]) => {
        expect(val1.value).to.eql(val2.value)
        expect(spy.callCount).to.equal(1)
        expect(val1.cache).to.equal('miss')
        expect(val2.cache).to.equal('hit')
      })
    })
  })

  describe('-> error handling (timeouts)', () => {
    let cacheInstance

    beforeEach(() => {
      cacheInstance = inMemoryCache({initial: preCached, log: dummyLog})
      const staleObj = {...cacheInstance.cache.get(dummyKey), TTL: -1000}
      cacheInstance.cache.set(dummyKey, staleObj)
    })

    it('should return stale cache and increase wait if promise reaches timeout', () => {
      const timeoutSpy = sinon.spy(() => new Promise((resolve) => {
        setTimeout(() => resolve('another object'), 1000)
      }))
      expect(cacheInstance.waiting.get(dummyKey)).to.be.a('undefined')
      return cacheInstance.get(dummyKey, { workerTimeout: 0, worker: timeoutSpy }).then((obj) => {
        expect(timeoutSpy.called).to.equal(true)
        expect(cacheInstance.waiting.get(dummyKey)).not.to.equal(0)
        expect(obj.value).to.eql(cacheValue)
        expect(obj.cache).to.equal('stale')
      })
    })

    it('should reject if cache is cold and a timeout occurs', () => {
      const timeoutSpy = sinon.spy(() => new Promise((resolve) => {
        setTimeout(() => resolve('another object'), 1000)
      }))
      return cacheInstance.get(dummyKey, {workerTimeout: 0, worker: timeoutSpy})
      .catch((err) => {
        expect(timeoutSpy.called).to.equal(true)
        expect(err).to.be.an(Error)
      })
    })

    it('should re-run promise after deltaWait time has passed', (done) => {
      const timeoutSpy = sinon.spy(() => new Promise((resolve) => {
        setTimeout(() => resolve('another object'), 1000)
      }))
      const resolveSpy = sinon.spy(() => Promise.resolve('hei verden'))
      const conf = {
        deltaWait: 10,
        workerTimeout: 10
      }
      cacheInstance.get(dummyKey, {...conf, worker: timeoutSpy}).then((obj) => {
        // 1. should return stale cache when timeout occurs
        expect(obj.value).to.eql(cacheValue)
        expect(cacheInstance.waiting.get(dummyKey).wait).to.equal(10)
        return cacheInstance.get(dummyKey, {...conf, worker: resolveSpy}).then((obj) => {
          // 2. should return stale cache before wait period has finished
          expect(obj.cache).to.equal('stale')
          expect(obj.value).to.eql(cacheValue)
          setTimeout(() => {
            return cacheInstance.get(dummyKey, {...conf, worker: resolveSpy}).then((obj) => {
              // 3. should return fresh data when wait period has finished
              expect(obj.value).to.eql('hei verden')
              expect(obj.cache).to.equal('miss')
              done()
            })
          }, 10)
        })
      }).catch(done)
    })
  })

  describe('-> error handling (rejections)', () => {
    let cacheInstance

    beforeEach(() => {
      cacheInstance = inMemoryCache({initial: preCached, log: dummyLog})
      const staleObj = {...cacheInstance.cache.get(dummyKey), TTL: -1000}
      cacheInstance.cache.set(dummyKey, staleObj)
    })

    it('should return stale cache and set wait if a promise rejection occurs', () => {
      const rejectionSpy = sinon.spy(() => Promise.reject(new Error('an error occurred')))
      expect(cacheInstance.waiting.get(dummyKey)).to.be.a('undefined')
      return cacheInstance.get(dummyKey, {worker: rejectionSpy}).then((obj) => {
        expect(rejectionSpy.called).to.equal(true)
        expect(cacheInstance.waiting.get(dummyKey)).not.to.equal(0)
        expect(obj.value).to.eql(cacheValue)
        expect(obj.cache).to.equal('stale')
      })
    })

    it('should reject if cache is cold and a rejection occurs', () => {
      const rejectionSpy = sinon.spy(() => Promise.reject(new Error('an error occurred')))
      return cacheInstance.get(dummyKey, {worker: rejectionSpy}).catch((err) => {
        expect(rejectionSpy.called).to.equal(true)
        expect(err).to.be.an(Error)
      })
    })

    it('should reject if an Error is thrown', () => {
      const rejectionSpy = sinon.spy(() => {
        throw new Error('an error occurred')
      })
      return cacheInstance.get(dummyKey, {worker: rejectionSpy}).catch((err) => {
        expect(rejectionSpy.called).to.equal(true)
        expect(err).to.be.an(Error)
      })
    })

    it('should re-run promise after deltaWait time has passed (when failing caused by a rejection)', (done) => {
      const rejectionSpy = sinon.spy(() => Promise.reject(new Error('')))
      const resolveSpy = sinon.spy(() => Promise.resolve('hei verden'))
      const conf = {
        deltaWait: 10
      }
      cacheInstance.get(dummyKey, {...conf, worker: rejectionSpy}).then((obj) => {
        // 1. should return stale cache when rejection occurs
        expect(obj.value).to.eql(cacheValue)
        return cacheInstance.get(dummyKey, {...conf, worker: resolveSpy}).then((obj) => {
          // 2. should return stale cache before wait period has finished
          expect(obj.value).to.eql(cacheValue)
          expect(obj.cache).to.equal('stale')
          setTimeout(() => {
            return cacheInstance.get(dummyKey, {...conf, worker: resolveSpy}).then((obj) => {
              // 3. should return fresh data when wait period has finished
              expect(obj.value).to.eql('hei verden')
              expect(obj.cache).to.equal('miss')
              done()
            })
          }, 10)
        })
      }).catch(done)
    })

    it('should re-run promise after deltaWait time has passed (when failing caused by a rejection and cache is cold)', (done) => {
      const rejectionSpy = sinon.spy(() => Promise.reject(new Error('')))
      const conf = {
        deltaWait: 10
      }
      cacheInstance.get('N/A', {...conf, worker: rejectionSpy}).catch((err) => {
        expect(err).to.be.an(Error)
        expect(rejectionSpy.callCount).to.equal(1)
        cacheInstance.get('N/A', {...conf, worker: rejectionSpy}).catch((err) => {
          expect(err).to.be.an(Error)
          expect(rejectionSpy.callCount).to.equal(1)
          cacheInstance.set('N/A', 'hei verden')
          cacheInstance.waiting.delete('N/A')
          setTimeout(() => {
            return cacheInstance.get('N/A', {...conf, worker: rejectionSpy}).then((obj) => {
              expect(rejectionSpy.callCount).to.equal(1)
              expect(obj.value).to.eql('hei verden')
              expect(obj.cache).to.equal('hit')
              done()
            })
          }, 10)
        })
      }).catch(done)
    })

    it('should increase deltaWait after several re-runs', (done) => {
      const rejectionSpy = sinon.spy(() => Promise.reject(new Error('')))
      const conf = {
        deltaWait: 10
      }
      expect(cacheInstance.waiting.get('N/A')).to.be.a('undefined')
      cacheInstance.get('N/A', {...conf, worker: rejectionSpy}).catch((err) => {
        expect(err).to.be.an(Error)
        expect(rejectionSpy.callCount).to.equal(1)
        expect(cacheInstance.waiting.get('N/A').wait).to.equal(10)
        const {started} = cacheInstance.waiting.get('N/A')
        cacheInstance.get('N/A', {...conf, worker: rejectionSpy}).catch((err) => {
          expect(err).to.be.an(Error)
          expect(rejectionSpy.callCount).to.equal(1)
          expect(cacheInstance.waiting.get('N/A')).to.eql({
            started,
            wait: 10,
            waitUntil: started + 10
          })
          setTimeout(() => {
            return cacheInstance.get('N/A', {...conf, worker: rejectionSpy}).catch((err) => {
              expect(err).to.be.an(Error)
              expect(rejectionSpy.callCount).to.equal(2)
              expect(cacheInstance.waiting.get('N/A').wait).to.equal(10)
              expect(cacheInstance.waiting.get('N/A').started).not.to.equal(started)
              done()
            })
          }, 10)
        })
      }).catch(done)
    })
  })

  describe('-> expire', () => {
    let cacheInstance

    beforeEach(() => {
      cacheInstance = inMemoryCache({initial: {
        'house/1': {hei: 'verden'},
        'house/2': {hei: 'verden'},
        'guest/2': {hei: 'verden'}
      }})
    })

    it('should expire all house keys', () => {
      cacheInstance.expire(['house/*'])
      expect(cacheInstance.cache.get('house/1').TTL).to.equal(0)
      expect(cacheInstance.cache.get('house/2').TTL).to.equal(0)
      expect(cacheInstance.cache.get('guest/2').TTL).not.to.equal(0)
    })

    it('should expire given house keys', () => {
      cacheInstance.expire(['house/*', 'guest/2'])
      expect(cacheInstance.cache.get('house/1').TTL).to.equal(0)
      expect(cacheInstance.cache.get('house/2').TTL).to.equal(0)
      expect(cacheInstance.cache.get('guest/2').TTL).to.equal(0)
    })
  })

  describe('-> LRU capabilities', () => {
    it('should throw away first entered entry on inital state', () => {
      const cacheInstance = inMemoryCache({
        initial: {
          'house/1': {hei: 'verden'},
          'house/2': {hei: 'verden'},
          'guest/3': {hei: 'verden'}
        },
        maxLength: 2
      })
      expect(cacheInstance.cache.itemCount).to.equal(2)
      expect(cacheInstance.cache.keys()).to.eql(['guest/3', 'house/2'])
    })

    it('should call dispose on set operations when LRU cache evicts object', () => {
      const cacheInstance = inMemoryCache({maxLength: 2})
      const spy = sinon.spy()
      cacheInstance.addDisposer(spy)
      cacheInstance.set('house/1', {hei: 'verden'})
      cacheInstance.set('house/2', {hei: 'verden'})
      cacheInstance.set('guest/3', {hei: 'verden'})
      expect(spy.called).to.equal(true)
      const key = spy.args[0][0]
      const {created, ...callArgs} = spy.args[0][1]
      expect(key).to.equal('house/1')
      expect(callArgs).to.eql({
        TTL: 86400000,
        value: { hei: 'verden' },
        cache: 'hit'
      })
      cacheInstance.removeDisposer(spy)
      cacheInstance.set('guest/4', {hei: 'verden'})
      expect(spy.callCount).to.equal(1)
      expect(cacheInstance.cache.itemCount).to.equal(2)
      expect(cacheInstance.cache.keys()).to.eql(['guest/4', 'guest/3'])
    })
  })
})
