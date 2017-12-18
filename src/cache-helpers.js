/**
 * @module
 **/
import {Observable} from 'rxjs/Observable'
import 'rxjs/add/observable/fromPromise'
import 'rxjs/add/operator/timeout'

export const createRegExp = (search) => {
  return new RegExp(search
    .replace(/\./g, '\\.')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\^/g, '\\^')
    .replace(/\$/g, '\\$')
    .replace(/\?/g, '\\?')
    .replace(/\*/g, '.*'))
}

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
  return waiting ? (waiting.started + waiting.wait) < Date.now() : true
}

export const waitingForError = (key, wait = {}) => {
  return new Error(`Waiting for next run for ${key}, wait: ${JSON.stringify(wait, null, 2)}`)
}

export const createEntry = (value, TTL) => {
  return {
    created: Date.now(),
    TTL,
    value
  }
}

export const createWait = (wait, now) => {
  const started = now || Date.now()
  return {
    started,
    wait
  }
}

export const createObservable = (promise, timeout) => {
  return Observable
    .fromPromise(promise())
    .timeout(timeout)
}

export const buildKey = ({key, value, isWaiting, full}) => {
  const expire = new Date(value.created + value.TTL + isWaiting.wait)
  const expireKey = expire < Date.now() ? 'expired' : 'expires'
  return Object.assign({
    key,
    created: new Date(value.created),
    [expireKey]: new Date(value.created + value.TTL + isWaiting.wait)
  },
  isWaiting.wait !== 0 ? {isWaiting} : {},
  full ? {value: value.value} : {})
}

export const formatWait = (waiting) => {
  if (!waiting) {
    return {
      wait: 0
    }
  }
  return {
    started: new Date(waiting.started),
    wait: waiting.wait
  }
}
