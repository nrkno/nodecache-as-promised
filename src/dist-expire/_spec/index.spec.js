import distCache from '../'
import inMemoryCache from '../..'
import sinon from 'sinon'
import expect from 'expect.js'
import {mockRedisFactory} from '../../utils/mock-redis-factory'
import {dummyLog} from '../../utils/log-helper'

const namespace = 'desketoy8080'

describe('dist-expire', () => {
  describe('-> istantiation', () => {
    it('should be possible', () => {
      const cache = inMemoryCache({log: dummyLog})
      cache.use(distCache(mockRedisFactory(), namespace))
      expect(cache).to.be.an(Object)
    })
  })

  describe('debug', () => {
    it('should print a debug of the cache with extra options', () => {
      // more thorough testing of debug in debug.spec.js
      const cache = inMemoryCache({initial: {hello: 'world'}})
      cache.use(distCache(mockRedisFactory(), namespace))
      const info = cache.debug({extraData: 'values'})
      expect(info.extraData).to.equal('values')
    })
  })

  describe('-> inheritance', () => {
    it('should be able to use methods from extended class (using middleware)', () => {
      const cache = inMemoryCache({log: dummyLog})
      cache.use(distCache(mockRedisFactory(), namespace))
      const p = () => Promise.resolve()
      const spy = sinon.spy(p)
      cache.set('hello', 'world')
      return cache.get('hello', {worker: spy}).then((obj) => {
        expect(obj.value).to.equal('world')
        expect(spy.called).to.equal(false)
      })
    })
  })

  describe('-> distributed expire', () => {
    it('should expire content on expire', () => {
      const spy = sinon.spy(() => Promise.resolve('world2'))
      const cache = inMemoryCache({initial: {hello: 'world'}, log: dummyLog})
      cache.use(distCache(mockRedisFactory(), namespace))
      cache.expire(['hello'])
      expect(cache.cache.get('hello').TTL).to.equal(0)
      return cache.get('hello', {worker: spy}).then((obj) => {
        expect(obj.value).to.equal('world2')
        expect(spy.called).to.equal(true)
      })
    })

    it('should handle errors if data is non-parsable', () => {
      const cbs = []
      const on = (event, cb) => cbs.push(cb)
      const onSpy = sinon.spy(on)
      const pub = (ns, data) => {
        cbs.forEach((cb) => cb(ns, data))
      }
      const sub = (ns, cb) => {
        if (ns === namespace) {
          return cb(null, 'ok')
        }
        return cb(new Error('dummyerror'), null)
      }
      const publishSpy = sinon.spy(pub)
      const subscribeSpy = sinon.spy(sub)
      const cache = inMemoryCache({initial: {hello: 'world'}, log: dummyLog})
      const callCount = dummyLog.error.callCount
      cache.use(distCache(mockRedisFactory({
        on: onSpy,
        publish: publishSpy,
        subscribe: subscribeSpy
      }), namespace))
      pub('asdf', '{')
      expect(dummyLog.error.callCount).to.equal(callCount + 1)
      const cache2 = inMemoryCache({initial: {hello: 'world'}, log: dummyLog})
      cache2.use(distCache(mockRedisFactory({
        on: onSpy,
        publish: publishSpy,
        subscribe: subscribeSpy
      }), 'dummy'))
      expect(dummyLog.error.callCount).to.equal(callCount + 2)
    })
  })
})
