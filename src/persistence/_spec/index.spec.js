import persistentCache from '../'
import inMemoryCache from '../../'
import sinon from 'sinon'
import expect from 'expect.js'
import {mockRedisFactory} from '../../utils/mock-redis-factory'
import * as utils from '../persistence-helpers'
import {dummyLog} from '../../utils/log-helper'

describe('persistence', () => {
  describe('-> istantiation', () => {
    it('should be possible', () => {
      const cache = inMemoryCache({log: dummyLog})
      cache.use(persistentCache(mockRedisFactory(), {bootload: false}))
      expect(cache).to.be.an(Object)
    })

    it('should print a debug of the cache with extra options', () => {
      // more thorough testing of debug in debug.spec.js
      const cache = inMemoryCache({initial: {hello: 'world'}})
      cache.use(persistentCache(mockRedisFactory(), {bootload: false}))
      const info = cache.debug({extraData: 'values'})
      expect(info.extraData).to.equal('values')
    })
  })

  describe('-> get (write to redis)', () => {
    let cache
    let mockFactory
    let setSpy

    beforeEach(() => {
      setSpy = sinon.spy()
      sinon.stub(utils, 'loadKeys').resolves({})
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
      utils.loadKeys.restore()
    })

    it('should write to redis when a cache miss occurs', () => {
      const p = () => Promise.resolve('hei')
      const spy = sinon.spy(p)
      const now = Date.now()
      const key = `key${now}`
      return cache.get(key, {ttl: 1000}, spy).then((obj) => {
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

    it('should not write to redis when a cache miss occurs and key matches ignored keys', () => {
      const p = () => Promise.resolve('hei')
      const spy = sinon.spy(p)
      const now = Date.now()
      const key = `/store/${now}`
      return cache.get(key, {}, spy).then((obj) => {
        expect(spy.called).to.equal(true)
        expect(obj.value).to.equal('hei')
        expect(obj.cache).to.equal('miss')
        expect(setSpy.called).to.equal(false)
      })
    })
  })
})
