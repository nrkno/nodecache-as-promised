import createCacheManagerInstance from '../'
import createCacheInstance from '../redis-wrapper'
import sinon from 'sinon'
import expect from 'expect.js'
import {mockRedisFactory} from './mock-redis-factory'
import {dummyLog} from './log-helper'

const namespace = 'desketoy8080'

describe('redis-wrapper', () => {
  describe('-> istantiation', () => {
    it('should be possible', () => {
      const cm = createCacheManagerInstance({log: dummyLog})
      const cacheInstance = createCacheInstance(cm, mockRedisFactory(), namespace)
      expect(cacheInstance).to.be.an(Object)
    })
  })

  describe('-> inheritance', () => {
    it('should be able to use methods from extended class', () => {
      const cm = createCacheManagerInstance({log: dummyLog})
      const cacheInstance = createCacheInstance(cm, mockRedisFactory(), namespace)
      const p = () => Promise.resolve()
      const spy = sinon.spy(p)
      cacheInstance.set('hei', 'verden')
      return cacheInstance.get('hei', {}, spy).then((obj) => {
        expect(obj.value).to.equal('verden')
        expect(spy.called).to.equal(false)
      })
    })
  })

  describe('-> distributed expire', () => {
    const p = () => Promise.resolve('world')
    const spy = sinon.spy(p)
    const cm = createCacheManagerInstance({initial: {hei: 'verden'}, log: dummyLog})
    const cacheInstance = createCacheInstance(cm, mockRedisFactory(), namespace)
    cacheInstance.expire(['hei'])
    expect(cacheInstance.cache.get('hei').TTL).to.equal(0)
    return cacheInstance.get('hei', {}, spy).then((obj) => {
      expect(obj.value).to.equal('world')
      expect(spy.called).to.equal(true)
    })
  })
})
