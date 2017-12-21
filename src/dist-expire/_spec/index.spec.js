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
      const cm = inMemoryCache({log: dummyLog})
      const cacheInstance = distCache(cm, mockRedisFactory(), namespace)
      expect(cacheInstance).to.be.an(Object)
    })
  })

  describe('-> inheritance', () => {
    it('should be able to use methods from extended class', () => {
      const cm = inMemoryCache({log: dummyLog})
      const cacheInstance = distCache(cm, mockRedisFactory(), namespace)
      const p = () => Promise.resolve()
      const spy = sinon.spy(p)
      cacheInstance.set('hello', 'world')
      return cacheInstance.get('hello', {}, spy).then((obj) => {
        expect(obj.value).to.equal('world')
        expect(spy.called).to.equal(false)
      })
    })
  })

  describe('-> distributed expire', () => {
    const p = () => Promise.resolve('world2')
    const spy = sinon.spy(p)
    const cm = inMemoryCache({initial: {hello: 'world'}, log: dummyLog})
    const cacheInstance = distCache(cm, mockRedisFactory(), namespace)
    cacheInstance.expire(['hello'])
    expect(cacheInstance.cache.get('hello').TTL).to.equal(0)
    return cacheInstance.get('hello', {}, spy).then((obj) => {
      expect(obj.value).to.equal('world2')
      expect(spy.called).to.equal(true)
    })
  })
})
