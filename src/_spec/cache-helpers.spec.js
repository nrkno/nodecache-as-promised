import {
  existsAndNotStale,
  createEntry,
  createObservable,
  finishedWaiting,
  buildKey,
  formatWait,
  createWait,
  createRegExp
} from '../cache-helpers'
import sinon from 'sinon'
import expect from 'expect.js'

describe('cache-helpers', () => {
  describe('-> finishedWaiting', () => {
    it('should return true when no wait object given', () => {
      expect(finishedWaiting()).to.equal(true)
    })

    it('should return false when wait is not yet done', () => {
      expect(finishedWaiting({
        started: Date.now() - 10,
        wait: 15
      })).to.equal(false)
    })

    it('should return true when wait is done', () => {
      const waiting = {
        started: Date.now() - 10,
        wait: 5
      }
      expect(finishedWaiting(waiting)).to.equal(true)
    })
  })

  describe('-> existsAndNotStale', () => {
    it('should return false if object does not exist', () => {
      expect(existsAndNotStale()).to.equal(false)
    })

    it('should return true if TTL is not reached', () => {
      const created = new Date('2017-09-05T08:00:00Z').getTime()
      const now = new Date('2017-09-05T08:00:10Z').getTime()
      const entry = {
        created,
        TTL: 60000
      }
      expect(existsAndNotStale(entry, null, now)).to.equal(true)
    })

    it('should return false if TTL is reached', () => {
      const created = new Date('2017-09-05T08:00:00Z').getTime()
      const now = new Date('2017-09-05T08:01:00Z').getTime()
      const entry = {
        created,
        TTL: 60000
      }
      expect(existsAndNotStale(entry, null, now)).to.equal(false)
    })

    it('should return true if TTL is reached but in waiting period', () => {
      const created = new Date('2017-09-05T08:00:00Z').getTime()
      const started = new Date('2017-09-05T08:01:00Z').getTime()
      const now = new Date('2017-09-05T08:01:05Z').getTime()
      const entry = {
        created,
        TTL: 60000
      }
      const wait = {
        started,
        wait: 10000
      }
      expect(existsAndNotStale(entry, wait, now)).to.equal(true)
    })

    it('should return false if TTL is reached but not in waiting period', () => {
      const created = new Date('2017-09-05T08:00:00Z').getTime()
      const started = new Date('2017-09-05T08:01:00Z').getTime()
      const now = new Date('2017-09-05T08:01:15Z').getTime()
      const entry = {
        created,
        TTL: 60000
      }
      const wait = {
        started,
        wait: 10000
      }
      expect(existsAndNotStale(entry, wait, now)).to.equal(false)
    })
  })

  describe('-> createEntry', () => {
    it('should create a wrapper object with metadata for cached', () => {
      const obj = {hello: 'world'}
      const entry = createEntry(obj, 10)
      expect(entry).to.only.have.keys(['created', 'TTL', 'value'])
      expect(entry.value).to.eql(obj)
    })
  })

  describe('-> createObservable', () => {
    it('should create an Observable with subscription capabilities from promise', (done) => {
      const p = () => Promise.resolve()
      const spy = sinon.spy(p)
      const obs = createObservable(spy, 0)
      obs.subscribe(() => done())
    })

    it('should create an Observable from promise with timeout support', (done) => {
      const p = () => setTimeout(() => Promise.resolve(), 10)
      const spy = sinon.spy(p)
      const obs = createObservable(spy, 0)
      obs.subscribe(Function.prototype, (err) => {
        expect(err).to.be.an(Error)
        done()
      })
    })
  })

  describe('-> formatWait', () => {
    it('should print waiting if wait is set', () => {
      const isWaiting = formatWait(createWait(10000, new Date('2017-09-05T08:00:00Z').getTime()))
      const key = 'hei'
      const value = {
        value: 'verden',
        created: new Date('2017-09-04T08:00:00Z').getTime(),
        TTL: 60000
      }
      const full = false
      const debugKey = buildKey({key, value, isWaiting, full})
      expect(debugKey).to.eql({
        key: 'hei',
        created: new Date('2017-09-04T08:00:00.000Z'),
        expired: new Date('2017-09-04T08:01:10.000Z'),
        isWaiting: {
          started: new Date('2017-09-05T08:00:00.000Z'),
          wait: 10000
        }
      })
    })

    it('should not print waiting if wait is not set', () => {
      const isWaiting = formatWait()
      const key = 'hei'
      const value = {
        value: 'verden',
        created: new Date('2017-09-04T08:00:00Z').getTime(),
        TTL: 60000
      }
      const full = false
      const debugKey = buildKey({key, value, isWaiting, full})
      expect(debugKey).to.eql({
        key: 'hei',
        created: new Date('2017-09-04T08:00:00.000Z'),
        expired: new Date('2017-09-04T08:01:00.000Z')
      })
    })
  })

  describe('-> createRegExp', () => {
    it('should create a regexp from a string', () => {
      const re = createRegExp('/houses/2')
      expect(re).to.eql(/\/houses\/2/)
    })

    it('should support * to .* rewrite', () => {
      const re = createRegExp('/houses/2*')
      expect(re).to.eql(/\/houses\/2.*/)
    })

    it('should support ? to \\? rewrite', () => {
      const re = createRegExp('/houses/2?hallo')
      expect(re).to.eql(/\/houses\/2\?hallo/)
    })

    it('should support . to \\. rewrite', () => {
      const re = createRegExp('/houses/2.hallo')
      expect(re).to.eql(/\/houses\/2\.hallo/)
    })

    it('should support [ to \\[ rewrite', () => {
      const re = createRegExp('/houses/2hallo[')
      expect(re).to.eql(/\/houses\/2hallo\[/)
    })

    it('should support ] to \\] rewrite', () => {
      const re = createRegExp('/houses/2hallo]')
      expect(re).to.eql(/\/houses\/2hallo\]/)
    })

    it('should support ^ to \\^ rewrite', () => {
      const re = createRegExp('/houses/2hallo^')
      expect(re).to.eql(/\/houses\/2hallo\^/)
    })

    it('should support $ to \\$ rewrite', () => {
      const re = createRegExp('/houses/2hallo$')
      expect(re).to.eql(/\/houses\/2hallo\$/)
    })

    it('should rewirte urls', () => {
      const re = createRegExp('http://localhost.no/?param1=yo&param2=yo')
      expect(re).to.eql(/http:\/\/localhost\.no\/\?param1=yo&param2=yo/)
    })
  })
})
