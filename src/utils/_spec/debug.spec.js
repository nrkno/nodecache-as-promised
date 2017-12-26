import {getCacheInfo} from '../debug'
import expect from 'expect.js'
import lruCache from 'lru-cache'
import {createEntry} from '../cache-helpers'

describe('debug', () => {
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
