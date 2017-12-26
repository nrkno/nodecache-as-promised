import {
  deleteKey,
  readKeys,
  extractKeyFromRedis,
  getRedisKey,
  isSerializable,
  loadObjects
} from '../persistence-helpers'
import {
  mockRedisFactory
} from '../../utils/mock-redis-factory'
import {dummyLog} from '../../utils/log-helper'
import sinon from 'sinon'
import expect from 'expect.js'

const parsedCache = {
  'asdf-123': {hello: 'world1'},
  'asdf-345': {hello: 'world2'},
  'asdf-100': {hello: 'world3'}
}

const redisCache = Object.keys(parsedCache).reduce((acc, key) => {
  acc[key] = JSON.stringify(parsedCache[key])
  return acc
}, {})

describe('persistence-helpers', () => {
  describe('-> getRedisKey', () => {
    it('generate key', () => {
      const key = getRedisKey('prefix', 'key')
      expect(key).to.equal('prefix-key')
    })
  })

  describe('-> extractKeyFromRedis', () => {
    it('should match keys', () => {
      const key = extractKeyFromRedis('prefix-http://localhost:8080', 'prefix-http://localhost:8080-myKey')
      expect(key).to.equal('myKey')
    })
  })

  describe('-> loadObjects', () => {
    let redisClient
    let mgetSpy

    it('should load keys', () => {
      const events = {}
      setTimeout(() => {
        events.data[0](['test-localhost8080-myKey'])
        events.end[0]()
      }, 20)
      const y = (keysToRead, cb) => {
        cb(null, [JSON.stringify({hei: 'verden'})])
      }
      mgetSpy = sinon.spy(y)
      redisClient = mockRedisFactory({mget: mgetSpy}, {events})()
      return loadObjects('test-localhost8080', redisClient, dummyLog).then((results) => {
        expect(results).to.eql({
          'test-localhost8080-myKey': {
            hei: 'verden'
          }
        })
      })
    })

    it('should handle errors when loading keys', () => {
      const events = {}
      setTimeout(() => {
        events.error[0](new Error('dummyerror'))
      }, 100)
      redisClient = mockRedisFactory({}, {events})()
      return loadObjects('test-localhost8080', redisClient, dummyLog).catch((err) => {
        expect(err.message).to.equal('dummyerror')
      })
    })
  })

  describe('-> deleteKey', () => {
    let redisClient
    let delSpy

    it('should delete keys', () => {
      const p = (key, cb) => cb(null, 'ok')
      delSpy = sinon.spy(p)
      redisClient = mockRedisFactory({del: delSpy})()
      return deleteKey('testkey', redisClient, dummyLog).then((result) => {
        expect(delSpy.called).to.equal(true)
        expect(result).to.equal('ok')
      })
    })

    it('should reject if an error occurrs keys', () => {
      const p = (key, cb) => cb(new Error('not ok'), null)
      delSpy = sinon.spy(p)
      redisClient = mockRedisFactory({del: delSpy})()
      return deleteKey('testkey', redisClient, dummyLog).catch((err) => {
        expect(delSpy.called).to.equal(true)
        expect(err).to.be.an(Error)
      })
    })
  })

  describe('-> readKeys', () => {
    let redisClient
    let mgetSpy

    it('should read multiple keys', () => {
      const values = Object.keys(redisCache).map((key) => redisCache[key])
      const p = (keys, cb) => cb(null, values)
      mgetSpy = sinon.spy(p)
      redisClient = mockRedisFactory({mget: mgetSpy})()
      return readKeys(Object.keys(redisCache), redisClient, dummyLog).then((result) => {
        expect(mgetSpy.called).to.equal(true)
        expect(result).to.eql(parsedCache)
      })
    })

    it('should resolve empty when no keys match', () => {
      const p = (keys, cb) => cb(null, [])
      mgetSpy = sinon.spy(p)
      redisClient = mockRedisFactory({mget: mgetSpy})()
      return readKeys(Object.keys([]), redisClient, dummyLog).then((result) => {
        expect(mgetSpy.called).to.equal(false)
        expect(result).to.eql({})
      })
    })

    it('should skip keys with invalid json', () => {
      const p = (keys, cb) => cb(null, ['{1}', '{"hello": "world"}'])
      mgetSpy = sinon.spy(p)
      redisClient = mockRedisFactory({mget: mgetSpy})()
      return readKeys(['key1', 'key2'], redisClient, dummyLog).then((result) => {
        expect(mgetSpy.called).to.equal(true)
        expect(result).to.eql({key2: {hello: 'world'}})
      })
    })

    it('should reject when an error occurrs', () => {
      const p = (keys, cb) => cb(new Error('not ok'), null)
      mgetSpy = sinon.spy(p)
      redisClient = mockRedisFactory({mget: mgetSpy})()
      return readKeys(Object.keys(redisCache), redisClient, dummyLog).catch((err) => {
        expect(mgetSpy.called).to.equal(true)
        expect(err).to.be.an(Error)
      })
    })
  })

  describe('isSerializable', () => {
    it('should return true for plain objects', () => {
      const obj = {
        str: 'string',
        arr: [1, '2', 1 / 2],
        obj: {
          1: 2,
          3: 4
        }
      }
      expect(isSerializable(obj)).to.equal(true)
    })

    it('should return false for objects with functions', () => {
      const obj = {
        func: () => {}
      }
      expect(isSerializable(obj)).to.equal(false)
    })

    it('should return false for objects with built in native objects', () => {
      const obj = {
        re: /123/,
        date: new Date()
      }
      expect(isSerializable(obj)).to.equal(false)
    })
  })
})
