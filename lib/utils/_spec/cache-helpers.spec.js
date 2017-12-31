'use strict';

var _cacheHelpers = require('../cache-helpers');

var _sinon = require('sinon');

var _sinon2 = _interopRequireDefault(_sinon);

var _expect = require('expect.js');

var _expect2 = _interopRequireDefault(_expect);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('cache-helpers', () => {
  describe('createWait', () => {
    it('should create a wait object', () => {
      const waiting = (0, _cacheHelpers.createWait)(100, 200);
      (0, _expect2.default)(waiting).to.eql({
        started: 200,
        wait: 100,
        waitUntil: 300
      });
    });
  });

  describe('-> isWaiting', () => {
    it('should return true if waiting', () => {
      (0, _expect2.default)((0, _cacheHelpers.isWaiting)((0, _cacheHelpers.createWait)(1000))).to.equal(true);
    });

    it('should return false if waiting is finished', () => {
      (0, _expect2.default)((0, _cacheHelpers.isWaiting)((0, _cacheHelpers.createWait)(-1000))).to.equal(false);
    });

    it('should return false if not waiting', () => {
      (0, _expect2.default)((0, _cacheHelpers.isWaiting)()).to.equal(false);
    });
  });

  describe('-> isFresh', () => {
    it('should return true if TTL is not reached', () => {
      (0, _expect2.default)((0, _cacheHelpers.isFresh)((0, _cacheHelpers.createEntry)('yo', 1000))).to.equal(true);
    });

    it('should return false if TTL is reached', () => {
      (0, _expect2.default)((0, _cacheHelpers.isFresh)((0, _cacheHelpers.createEntry)('yo', -1000))).to.equal(false);
    });
  });

  describe('-> createEntry', () => {
    it('should create a wrapper object with metadata for cached', () => {
      const obj = { hello: 'world' };
      const entry = (0, _cacheHelpers.createEntry)(obj, 10);
      (0, _expect2.default)(entry).to.only.have.keys(['created', 'TTL', 'value']);
      (0, _expect2.default)(entry.value).to.eql(obj);
    });
  });

  describe('-> createObservable', () => {
    it('should create an Observable with subscription capabilities from promise', done => {
      const p = () => Promise.resolve();
      const spy = _sinon2.default.spy(p);
      const obs = (0, _cacheHelpers.createObservable)(spy, 0);
      obs.subscribe(() => done());
    });

    it('should create an Observable from promise with timeout support', done => {
      const p = () => setTimeout(() => Promise.resolve(), 10);
      const spy = _sinon2.default.spy(p);
      const obs = (0, _cacheHelpers.createObservable)(spy, 0);
      obs.subscribe(Function.prototype, err => {
        (0, _expect2.default)(err).to.be.an(Error);
        done();
      });
    });
  });

  describe('-> createRegExp', () => {
    it('should create a regexp from a string', () => {
      const re = (0, _cacheHelpers.createRegExp)('/houses/2');
      (0, _expect2.default)(re).to.eql(/\/houses\/2/);
    });

    it('should support * to .* rewrite', () => {
      const re = (0, _cacheHelpers.createRegExp)('/houses/2*');
      (0, _expect2.default)(re).to.eql(/\/houses\/2.*/);
    });

    it('should support ? to \\? rewrite', () => {
      const re = (0, _cacheHelpers.createRegExp)('/houses/2?hallo');
      (0, _expect2.default)(re).to.eql(/\/houses\/2\?hallo/);
    });

    it('should support . to \\. rewrite', () => {
      const re = (0, _cacheHelpers.createRegExp)('/houses/2.hallo');
      (0, _expect2.default)(re).to.eql(/\/houses\/2\.hallo/);
    });

    it('should support [ to \\[ rewrite', () => {
      const re = (0, _cacheHelpers.createRegExp)('/houses/2hallo[');
      (0, _expect2.default)(re).to.eql(/\/houses\/2hallo\[/);
    });

    it('should support ] to \\] rewrite', () => {
      const re = (0, _cacheHelpers.createRegExp)('/houses/2hallo]');
      (0, _expect2.default)(re).to.eql(/\/houses\/2hallo\]/);
    });

    it('should support ^ to \\^ rewrite', () => {
      const re = (0, _cacheHelpers.createRegExp)('/houses/2hallo^');
      (0, _expect2.default)(re).to.eql(/\/houses\/2hallo\^/);
    });

    it('should support $ to \\$ rewrite', () => {
      const re = (0, _cacheHelpers.createRegExp)('/houses/2hallo$');
      (0, _expect2.default)(re).to.eql(/\/houses\/2hallo\$/);
    });

    it('should rewrite urls', () => {
      const re = (0, _cacheHelpers.createRegExp)('http://localhost.no/?param1=yo&param2=yo');
      (0, _expect2.default)(re).to.eql(/http:\/\/localhost\.no\/\?param1=yo&param2=yo/);
    });
  });
});