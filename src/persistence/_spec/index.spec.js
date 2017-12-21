import persistentCache from '../'
import inMemoryCache from '../../'
import sinon from 'sinon'
import expect from 'expect.js'
import {mockRedisFactory} from '../../utils/mock-redis-factory'
import {dummyLog} from '../../utils/log-helper'

describe('persistence', () => {
  describe('-> istantiation', () => {
    it('should be possible', () => {
      const cm = inMemoryCache({log: dummyLog})
      const cacheInstance = persistentCache(cm, mockRedisFactory())
      expect(cacheInstance).to.be.an(Object)
    })
  })

  describe('-> get (write to redis)', () => {
    let cacheInstance
    let mockFactory
    let setSpy

    beforeEach(() => {
      setSpy = sinon.spy()
      mockFactory = mockRedisFactory({
        set: setSpy
      })
      const cm = inMemoryCache({log: dummyLog})

      cacheInstance = persistentCache(
        cm,
        mockFactory,
        {
          doNotPersist: /store/,
          keySpace: 'myCache',
          grace: 1000
        }
      )
    })

    it('should write to redis when a cache miss occurs', () => {
      const p = () => Promise.resolve('hei')
      const spy = sinon.spy(p)
      const now = Date.now()
      const key = `key${now}`
      return cacheInstance.get(key, {ttl: 1000}, spy).then((obj) => {
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
      return cacheInstance.get(key, {}, spy).then((obj) => {
        expect(spy.called).to.equal(true)
        expect(obj.value).to.equal('hei')
        expect(obj.cache).to.equal('miss')
        expect(setSpy.called).to.equal(false)
      })
    })
  })
})
