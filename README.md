# @nrk/doublecache-as-promised
Provides an in-memory cache-wrapper around `lru-cache`, supporting stale objects and expire-methods (makes stale). Caches are filled using promises, wrapped around `rxjs/fromPromise` for queuing, retry-mechanisms and waiting in-between rejected promises.

## Installing

```
npm install @nrk/kurator-node-cache --save
```

## Basic usage
```js
import createCacheInstance from '@nrk/kurator-node-cache';

const cacheInstance = createCacheInstance({
  initial: {
    foo: 'bar'
  },                  // initial state
  maxLength: 1000,              // object count
  maxAge: 24 * 60 * 60 * 1000   // in ms
});
cacheInstance.set('key', {hello: 'world'});
cacheInstance.get('key').then(console.log);
// {value: {hello: 'world'}, created: 123456789, cache: 'hit', TTL: 86400000}
cacheInstance.get('foo').then(console.log);
// {value: {foo: 'bar'}, created: 123456789, cache: 'hit', TTL: 86400000}
```

#### Using promises
```js
cacheInstance.get('key', {
  ttl: 60000,               // in ms
  workerTimeout: 5000,
  deltaWait: 5000
}, Promise.resolve('hei').then(console.log);
// {value: 'hei', created: 123456789, cache: 'miss', TTL: 60000}
```

## Extras
Optional extra functionality using **higher order functions**.

#### Distributed expire
```js
import createCacheInstance from '@nrk/kurator-node-cache';
import redisWrapper from '@nrk/kurator-node-cache/lib/redis-wrapper';
import Redis from 'io-redis';

// server # 1 + 2
const ci = createCacheInstance({
  initial: {                    // initial state
    foo: 'bar'
  },                  
  maxLength: 1000,              // object count
  maxAge: 24 * 60 * 60 * 1000   // in ms
});

const redisFactory = () => new Redis(/* options */);

const cacheInstance = redisWrapper(ci, redisFactory, 'namespace');
cacheInstance.expire(['foo']);
setTimeout(() => {
  cacheInstance.get('foo').then(console.log);
  // expired in server # 1 + 2
  // {value: {foo: 'bar'}, created: 123456789, cache: 'stale', TTL: 86400000}
}, 1000);
```

#### Persisting cache misses
* coming later *
