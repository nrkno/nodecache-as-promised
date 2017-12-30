import persistentCache from '../'
import inMemoryCache from '../../'
import sinon from 'sinon'
import expect from 'expect.js'
import {mockRedisFactory} from '../../utils/mock-redis-factory'
import * as utils from '../persistence-helpers'
import {dummyLog} from '../../utils/log-helper'
import pkg from '../../../package.json'

describe('persistence', () => {
  describe('-> istantiation', () => {
    it('should be possible', () => {
      const cache = inMemoryCache({log: dummyLog})
      cache.use(persistentCache(mockRedisFactory(), {bootload: false}))
      expect(cache).to.be.an(Object)
    })
  })

  describe('debug', () => {
    it('should print a debug of the cache with extra options', () => {
      // more thorough testing of debug in debug.spec.js
      const cache = inMemoryCache({initial: {hello: 'world'}})
      cache.use(persistentCache(mockRedisFactory(), {bootload: false}))
      const info = cache.debug({extraData: 'values'})
      expect(info.extraData).to.equal('values')
    })
  })

  describe('-> get (write to redis on MISS)', () => {
    let cache
    let mockFactory
    let setSpy

    beforeEach(() => {
      const p = (key, json, ex, ttl, cb) => {
        if (key.indexOf('setFail') > -1) {
          return cb(new Error('dummyerror'), null)
        }
        cb(null, 'ok')
      }
      setSpy = sinon.spy(p)
      sinon.stub(utils, 'loadObjects').resolves({
        [`${pkg.name}-myCache-house/1`]: '{"hello": "world"}'
      })
      mockFactory = mockRedisFactory({
        set: setSpy
      })
      cache = inMemoryCache({log: dummyLog})
      cache.use(persistentCache(
        mockFactory,
        {
          doNotPersist: /store/,
          keySpace: 'myCache',
          grace: 1000
        }
      ))
    })

    afterEach(() => {
      cache.destroy()
      utils.loadObjects.restore()
    })

    it('should write to redis when a cache miss occurs', () => {
      const spy = sinon.spy(() => Promise.resolve('hei'))
      const now = Date.now()
      const key = `key${now}`
      return cache.get(key, {ttl: 1000, worker: spy}).then((obj) => {
        expect(spy.called).to.equal(true)
        expect(obj.value).to.equal('hei')
        expect(obj.cache).to.equal('miss')
        const [[redisKey, json, ex, expire]] = setSpy.args
        const parsed = JSON.parse(json)
        expect(redisKey).to.contain(key)
        expect(parsed).to.have.keys(['created', 'TTL', 'value', 'cache'])
        expect(ex).to.equal('ex')
        expect(expire).to.equal(2)
        expect(parsed.value).to.equal('hei')
      })
    })

    it('should log a warning when write to redis fails (on cache miss)', () => {
      const spy = sinon.spy(() => Promise.resolve('hei'))
      const key = 'setFail'
      const callCount = dummyLog.warn.callCount
      return cache.get(key, {ttl: 1000, worker: spy}).then((obj) => {
        expect(spy.called).to.equal(true)
        expect(obj.value).to.equal('hei')
        expect(obj.cache).to.equal('miss')
        const [[redisKey, json, ex, expire]] = setSpy.args
        const parsed = JSON.parse(json)
        expect(redisKey).to.contain(key)
        expect(parsed).to.have.keys(['created', 'TTL', 'value', 'cache'])
        expect(ex).to.equal('ex')
        expect(expire).to.equal(2)
        expect(parsed.value).to.equal('hei')
        expect(dummyLog.warn.callCount).to.equal(callCount + 1)
      })
    })

    it('should not write to redis when a cache miss occurs and key matches ignored keys', () => {
      const spy = sinon.spy(() => Promise.resolve('hei'))
      const now = Date.now()
      const key = `/store/${now}`
      return cache.get(key, {worker: spy}).then((obj) => {
        expect(spy.called).to.equal(true)
        expect(obj.value).to.equal('hei')
        expect(obj.cache).to.equal('miss')
        expect(setSpy.called).to.equal(false)
      })
    })
  })

  describe('onDispose', () => {
    let delSpy
    let mockFactory
    let cache

    beforeEach(() => {
      delSpy = sinon.spy((key, cb) => {
        if (key.indexOf('house/1') > -1) {
          return cb(null, 'ok')
        }
        cb(new Error('dummyerror'), null)
      })
      mockFactory = mockRedisFactory({
        del: delSpy
      })
      cache = inMemoryCache({log: dummyLog, maxLength: 2})
      cache.use(persistentCache(
        mockFactory,
        {
          doNotPersist: /store/,
          bootload: false,
          keySpace: 'myCache',
          grace: 1000
        }
      ))
    })

    afterEach(() => {
      cache.destroy()
    })

    it('should evict key from redis when lru cache evicts key', () => {
      cache.set('house/1', {hei: 'verden'})
      cache.set('house/2', {hei: 'verden'})
      cache.set('guest/3', {hei: 'verden'})
      expect(delSpy.called).to.equal(true)
      expect(delSpy.args[0][0]).to.equal(utils.getRedisKey(`${pkg.name}-myCache`, 'house/1'))
    })

    it('should catch error in redis.del when lru cache evicts key', (done) => {
      const count = dummyLog.error.callCount
      cache.set('guest/3', {hei: 'verden'})
      cache.set('house/1', {hei: 'verden'})
      cache.set('house/2', {hei: 'verden'})
      expect(delSpy.called).to.equal(true)
      expect(delSpy.args[0][0]).to.equal(utils.getRedisKey(`${pkg.name}-myCache`, 'guest/3'))
      setTimeout(() => {
        expect(dummyLog.error.callCount).to.equal(count + 1)
        done()
      })
    })
  })
})
