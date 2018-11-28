/**
 * @module
 **/
import { from } from 'rxjs';
import { timeout as rxjsTimeout } from 'rxjs/operators';

export const createRegExp = (search) => {
  return new RegExp(
    search
      .replace(/\./g, '\\.')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\^/g, '\\^')
      .replace(/\$/g, '\\$')
      .replace(/\?/g, '\\?')
      .replace(/\*/g, '.*')
  );
};

export const isFresh = (entry, nowDefault) => {
  const now = nowDefault || Date.now();
  return entry.created + entry.TTL > now;
};

export const isWaiting = (waiting, nowDefault) => {
  const now = nowDefault || Date.now();
  if (waiting) {
    return waiting.waitUntil > now;
  }
  return false;
};

export const waitingForError = (key, wait = {}) => {
  return new Error(`Waiting for next run for ${key}, wait: ${JSON.stringify(wait, null, 2)}`);
};

export const createEntry = (value, TTL, date) => {
  const created = date || Date.now();
  return {
    created,
    TTL,
    value
  };
};

export const createWait = (wait, now) => {
  const started = now || Date.now();
  return {
    started,
    wait,
    waitUntil: started + wait
  };
};

export const createObservable = (promiseCreator, timeout, logger) => {
  const promise = promiseCreator().catch((err) => {
    logger.error('An error occured while executing worker promise', err);
    throw err;
  });

  return from(promise).pipe(rxjsTimeout(timeout));
};
