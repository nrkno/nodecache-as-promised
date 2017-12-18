# Motivation
`doublecache-as-promised` is heavily inspired by how [Varnish](https://varnish-cache.org/) works. The module is not intended to replace Varnish (but works great in combination). Instead its intention is more fine-grained control over caching behaviour and making cached objects instantly available without any parsing or serialization needs. In general Varnish is working great as an edge/burst/failover cache, in addition as a reverse proxy and loadbalancer. `doublecache-as-promised` main use case is an NodeJs application cache.

There are several cache solutions for Node on NPM, but they're often either too basic or
using some kind of combination of prequisites that are not compatible with our kind of setup.

## Features
- Serving cache from in-memory is always faster than fetching data over network - but due to constraints in available memory an LRU-cache is enabled avoid memory leaks.
- For an editor in a newsroom it is important to be able to publish rapid changes which needs to be reflected in the cache. On demand expiry/purge is available as a plugin depending on using Redis pub/sub
- For developers and operations it is mandatory to be able re-deploy a server whenever needed. To avoid high back-pressure from cold caches, cache-misses may be stored in a Redis (assuming using a `ioredis`-factory) that are preloading the cache when the server restarts.
- Using prepared stores (such as redux), custom class instances and native objects such as Date and RegExp needs a function to return values. In-memory caching provides supports for these and other non-serializable data (using JSON.stringify). Non-serializable objects are filtered out on cache-miss when using Redis persistence.
- When the cache for a given key is cold/stale, requests asking for the same key only spawns *one* worker (subsequent requests are queued using RxJs)
- If a worker (promise) fails, stale data is served until the worker starts resolving again or the key is evicted using LRU-semantics
- To avoid spamming of backend resources when a cached object is stale, there is a configurable retry-wait timer to avoid this situation.


## Installing

```
npm install @nrk/doublecache-as-promised --save
```

## Basic usage
```js
import inMemoryCache from '@nrk/doublecache-as-promised';

const cacheInstance = inMemoryCache({
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
import createCacheInstance from '@nrk/doublecache-as-promised';
import redisWrapper from '@nrk/doublecache-as-promised/lib/redis-wrapper';
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

## Final note
Ideally one should not make use of caches when not needing them - due to the inherent complexity it entails - but for services which require high resilience and throughput it is an easy way out of saving money on hardware, decreased response times and
