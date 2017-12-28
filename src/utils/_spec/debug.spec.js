import {
  getCacheInfo,
  buildKey
} from '../debug'
import expect from 'expect.js'
import lruCache from 'lru-cache'
import {
  createEntry,
  createWait
} from '../cache-helpers'

describe('debug', () => {
  describe('-> formatWait', () => {
    it('should print waiting if wait is set', () => {
      // const isWaiting = formatWait(createWait(10000, new Date('2017-09-05T08:00:00Z').getTime()))
      const waiting = createWait(10000, new Date('2017-09-04T08:01:00Z').getTime())
      const key = 'hei'
      const value = {
        value: 'verden',
        created: new Date('2017-09-04T08:00:00Z').getTime(),
        TTL: 60000
      }
      const full = false
      const debugKey = buildKey({key, value, waiting, full})
      expect(debugKey).to.eql({
        key: 'hei',
        created: new Date('2017-09-04T08:00:00.000Z'),
        expired: new Date('2017-09-04T08:01:00.000Z'),
        waiting: {
          started: new Date('2017-09-04T08:01:00.000Z'),
          wait: 10000,
          waitUntil: new Date('2017-09-04T08:01:10.000Z')
        }
      })
    })

    it('should not print waiting if wait is not set', () => {
      const key = 'hei'
      const value = {
        value: 'verden',
        created: new Date('2017-09-04T08:00:00Z').getTime(),
        TTL: 60000
      }
      const full = false
      const debugKey = buildKey({key, value, full})
      expect(debugKey).to.eql({
        key: 'hei',
        created: new Date('2017-09-04T08:00:00.000Z'),
        expired: new Date('2017-09-04T08:01:00.000Z')
      })
    })
  })

  describe('getCacheInfo', () => {
    it('should print debug info from cache', () => {
      const maxAge = 10000
      const waiting = new Map()
      const cache = lruCache({
        max: 100,
        maxAge
      })

      const entry = {...createEntry({hello: 'world'}, 12345), cache: 'hit'}
      const entry2 = {...createEntry({foo: 'bar'}, 12345), cache: 'hit'}
      const entry3 = {...createEntry({hello: 'world'}, -1), cache: 'hit'}
      cache.set('yo', entry)
      cache.set('notinresults', entry2)
      cache.set('yo2', entry3)
      // omit now field
      const {now, ...info} = getCacheInfo({
        full: true,
        search: 'yo*',
        cache,
        maxAge,
        waiting
      })
      expect(info).to.eql({
        full: true,
        itemCount: 3,
        keys: {
          hot: [
            {
              created: new Date(entry.created),
              expires: new Date(entry.created + entry.TTL),
              key: 'yo',
              value: {
                hello: 'world'
              }
            }
          ],
          stale: [{
            created: new Date(entry3.created),
            expired: new Date(entry3.created + entry3.TTL),
            key: 'yo2',
            value: {
              hello: 'world'
            }
          }]
        },
        maxAge: '0.002777777777777778h',
        search: 'yo*'
      })
    })
  })
})
