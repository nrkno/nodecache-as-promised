import {
  createEntry,
  createObservable,
  createWait,
  createRegExp,
  isFresh,
  isWaiting
} from '../cache-helpers'
import sinon from 'sinon'
import expect from 'expect.js'

describe('cache-helpers', () => {
  describe('createWait', () => {
    it('should create a wait object', () => {
      const waiting = createWait(100, 200)
      expect(waiting).to.eql({
        started: 200,
        wait: 100,
        waitUntil: 300
      })
    })
  })

  describe('-> isWaiting', () => {
    it('should return true if waiting', () => {
      expect(isWaiting(createWait(1000))).to.equal(true)
    })

    it('should return false if waiting is finished', () => {
      expect(isWaiting(createWait(-1000))).to.equal(false)
    })

    it('should return false if not waiting', () => {
      expect(isWaiting()).to.equal(false)
    })
  })

  describe('-> isFresh', () => {
    it('should return true if TTL is not reached', () => {
      expect(isFresh(createEntry('yo', 1000))).to.equal(true)
    })

    it('should return false if TTL is reached', () => {
      expect(isFresh(createEntry('yo', -1000))).to.equal(false)
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
      const p = () => new Promise((resolve) => setTimeout(() => resolve(), 10))
      const spy = sinon.spy(p)
      const obs = createObservable(spy, 0)
      obs.subscribe(Function.prototype, (err) => {
        expect(err).to.be.an(Error)
        done()
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

    it('should rewrite urls', () => {
      const re = createRegExp('http://localhost.no/?param1=yo&param2=yo')
      expect(re).to.eql(/http:\/\/localhost\.no\/\?param1=yo&param2=yo/)
    })
  })
})
