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
      return cache.get('hello', {}, spy).then((obj) => {
        expect(obj.value).to.equal('world')
        expect(spy.called).to.equal(false)
      })
    })
  })

  describe('-> distributed expire', () => {
    const p = () => Promise.resolve('world2')
    const spy = sinon.spy(p)
    const cache = inMemoryCache({initial: {hello: 'world'}, log: dummyLog})
    cache.use(distCache(mockRedisFactory(), namespace))
    cache.expire(['hello'])
    expect(cache.cache.get('hello').TTL).to.equal(0)
    return cache.get('hello', {}, spy).then((obj) => {
      expect(obj.value).to.equal('world2')
      expect(spy.called).to.equal(true)
    })
  })
})
