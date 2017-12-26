import {
  deleteKey,
  readKeys,
  extractKeyFromRedis,
  getRedisKey,
  isSerializable,
  loadKeys
} from '../persistence-helpers'
import {
  mockRedisFactory
} from '../../utils/mock-redis-factory'
import {dummyLog} from '../../utils/log-helper'
import sinon from 'sinon'
import expect from 'expect.js'

const cache = {
  'asdf-123': '123',
  'asdf-345': '345',
  'asdf-100': '567'
}

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

  describe('-> loadKeys', () => {
    let redisClient
    let scanStreamSpy
    let mgetSpy

    it('should load keys', () => {
      const events = {}
      const p = ({match, cound}) => {
        return {
          on: (event, cb) => {
            if (!events[event]) {
              events[event] = []
            }
            events[event].push(cb)
          }
        }
      }
      scanStreamSpy = sinon.spy(p)
      setTimeout(() => {
        events.data[0](['test-localhost8080-myKey'])
        events.end[0]()
      }, 20)
      const y = (keysToRead, cb) => {
        cb(null, [JSON.stringify({hei: 'verden'})])
      }
      mgetSpy = sinon.spy(y)
      redisClient = mockRedisFactory({scanStream: scanStreamSpy, mget: mgetSpy})()
      return loadKeys('test-localhost8080', redisClient, dummyLog).then((results) => {
        expect(results).to.eql({
          'test-localhost8080-myKey': {
            hei: 'verden'
          }
        })
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
      const values = Object.keys(cache).map((key) => cache[key])
      const p = (keys, cb) => cb(null, values)
      mgetSpy = sinon.spy(p)
      redisClient = mockRedisFactory({mget: mgetSpy})()
      return readKeys(Object.keys(cache), redisClient, dummyLog).then((result) => {
        expect(mgetSpy.called).to.equal(true)
        expect(result).to.eql(cache)
      })
    })

    it('should reject when an error occurrs', () => {
      const p = (keys, cb) => cb(new Error('not ok'), null)
      mgetSpy = sinon.spy(p)
      redisClient = mockRedisFactory({mget: mgetSpy})()
      return readKeys(Object.keys(cache), redisClient, dummyLog).catch((err) => {
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
