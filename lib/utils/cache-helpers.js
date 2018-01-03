'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createObservable = exports.createWait = exports.createEntry = exports.waitingForError = exports.isWaiting = exports.isFresh = exports.createRegExp = undefined;

var _Observable = require('rxjs/Observable');

require('rxjs/add/observable/fromPromise');

require('rxjs/add/operator/timeout');

const createRegExp = exports.createRegExp = search => {
  return new RegExp(search.replace(/\./g, '\\.').replace(/\[/g, '\\[').replace(/\]/g, '\\]').replace(/\^/g, '\\^').replace(/\$/g, '\\$').replace(/\?/g, '\\?').replace(/\*/g, '.*'));
}; /**
    * @module
    **/
const isFresh = exports.isFresh = (entry, nowDefault) => {
  const now = nowDefault || Date.now();
  return entry.created + entry.TTL > now;
};

const isWaiting = exports.isWaiting = (waiting, nowDefault) => {
  const now = nowDefault || Date.now();
  if (waiting) {
    return waiting.waitUntil > now;
  }
  return false;
};

/*
export const existsAndNotStale = (entry, wait, nowDefault) => {
  const now = nowDefault || Date.now()

  let remainingToWait = 0
  if (wait) {
    remainingToWait = wait.started + wait.wait - now
  }
  if (remainingToWait > 0) {
    return true
  }
  if (entry) {
    return entry.created + entry.TTL > now
  }
  return false
}

export const finishedWaiting = (waiting) => {
  return waiting ? waiting.waitUntil < Date.now() : true
}
*/

const waitingForError = exports.waitingForError = (key, wait = {}) => {
  return new Error(`Waiting for next run for ${key}, wait: ${JSON.stringify(wait, null, 2)}`);
};

const createEntry = exports.createEntry = (value, TTL, date) => {
  const created = date || Date.now();
  return {
    created,
    TTL,
    value
  };
};

const createWait = exports.createWait = (wait, now) => {
  const started = now || Date.now();
  return {
    started,
    wait,
    waitUntil: started + wait
  };
};

const createObservable = exports.createObservable = (promise, timeout) => {
  return _Observable.Observable.fromPromise(promise()).timeout(timeout);
};