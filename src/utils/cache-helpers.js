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

export const isFresh = (entry, nowDefault) => {
  const now = nowDefault || Date.now()
  return entry.created + entry.TTL > now
}

export const isWaiting = (waiting, nowDefault) => {
  const now = nowDefault || Date.now()
  if (waiting) {
    return waiting.waitUntil > now
  }
  return false
}

export const waitingForError = (key, wait = {}) => {
  return new Error(`Waiting for next run for ${key}, wait: ${JSON.stringify(wait, null, 2)}`)
}

export const createEntry = (value, TTL, date) => {
  const created = date || Date.now()
  return {
    created,
    TTL,
    value
  }
}

export const createWait = (wait, now) => {
  const started = now || Date.now()
  return {
    started,
    wait,
    waitUntil: started + wait
  }
}

export const createObservable = (promise, timeout) => {
  return Observable
    .fromPromise(promise())
    .timeout(timeout)
}
