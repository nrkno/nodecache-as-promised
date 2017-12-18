import {
  sortKeys,
  deleteKeys,
  readKeys,
  deDup,
  createRegExp,
  isSerializable
} from '../persistence-helpers'
import {
  mockRedisFactory
} from './mock-redis-factory'
import {dummyLog} from './log-helper'
import sinon from 'sinon'
import expect from 'expect.js'

const cache = {
  'asdf-123': '123',
  'asdf-345': '345',
  'asdf-100': '567'
}

describe('persistence-helpers', () => {
  describe('-> sortKeys', () => {
    it('should sort keys based on regexp', () => {
      const sortedKeys = sortKeys(Object.keys(cache), /(asdf-)(\d+)/)  // nb: matches on second group
      expect(sortedKeys).to.eql(['asdf-100', 'asdf-123', 'asdf-345'])
    })
  })

  describe('-> deleteKeys', () => {
    let redisClient
    let delSpy

    it('should delete keys', () => {
      const p = (key, cb) => cb(null, 'ok')
      delSpy = sinon.spy(p)
      redisClient = mockRedisFactory({del: delSpy})()
      return deleteKeys(Object.keys(cache), redisClient, dummyLog).then((result) => {
        expect(delSpy.called).to.equal(true)
        expect(result.length).to.equal(3)
      })
    })

    it('should reject if an error occurrs keys', () => {
      const p = (key, cb) => cb(new Error('not ok'), null)
      delSpy = sinon.spy(p)
      redisClient = mockRedisFactory({del: delSpy})()
      return deleteKeys(Object.keys(cache), redisClient, dummyLog).catch((err) => {
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

  describe('-> deDup', () => {
    it('should remove duplicat keys and keep most recent one', () => {
      const keys = [
        'desketoy8080-1234/house/2',
        'desketoy8080-1000/house/2',
        'desketoy8080-1000/feed/2'
      ]
      const deDupedKeys = deDup(keys, createRegExp('desketoy8080'))
      expect(deDupedKeys).to.eql([
        'desketoy8080-1234/house/2',
        'desketoy8080-1000/feed/2'
      ])
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
