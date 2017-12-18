# @nrk/doublecache-as-promised

> Fast and resilient cache for NodeJs targeting high-volume sites

- [Features](#features)
- [Installing](#installing)
- [Basic usage](#basic-usage)
- [Distributed capabilites](#distributed-capabilites)
- [Local development](#local-development)
- [Building and committing](#building-and-committing)

# Motivation
`doublecache-as-promised` is heavily inspired by how [Varnish](https://varnish-cache.org/) works. It is not intended to replace Varnish (but works great in combination). In general Varnish works great as an edge/burst/failover cache, in addition to reverse proxying and loadbalancing. But there are times when NodeJs must do some heavy lifting without consuming to many resources and short response times (eg. with a short cache window in Varnish). This module's intention is to give more fine-grained control over caching behaviour and making parsed cached objects available in NodeJs.

There are several cache solutions on NPM, but they're often either too basic or
using some kind of combination of prequisites that are not compatible with our kind of setup.

## Features
- __In-memory caching__ is used as primary cache since it will always be faster than fetching data over network. An LRU-cache is enabled to constraint amount of memory used.
- __For an editor__ in a newsroom it is important to be able to publish rapid changes without waiting for caches to expire. On demand expiry/purge is provided as a plugin depending on Redis pub/sub.
- __For developers and operations__ it is mandatory to be able re-deploy a server whenever needed. To avoid high back-pressure from cold caches, cache-misses may be stored in a Redis (assuming using a `ioredis`-factory) that may preload the cache when the server restarts.
- __Custom class instances and native objects__ such as Date, RegExp and redux stores needs a function to return values. In-memory caching provides support for these and other non-serializable data (using JSON.stringify). Non-serializable objects are filtered out on cache-miss when using Redis persistence.
- __Worker promises__ are used to ensure that only __one__ Promise is performed when several concurrent requests are requesting data from the same key, while the cache is cold/stale (using RxJs)
- __Stale cache is returned if a worker promise rejects__, based on the previous cached object.
- __Avoid spamming backend resources__ using a configurable retry-wait parameter, serving either a stale object or rejection.

## Installing

```
npm install @nrk/doublecache-as-promised --save
```

## Basic usage
```js
import inMemoryCache from '@nrk/doublecache-as-promised';

const cache = inMemoryCache({
  initial: {
    foo: 'bar'
  },                  // initial state
  maxLength: 1000,              // object count
  maxAge: 24 * 60 * 60 * 1000   // in ms
})
cache.set('key', {hello: 'world'})
cache.get('key').then(console.log)
// {value: {hello: 'world'}, created: 123456789, cache: 'hit', TTL: 86400000}
cache.get('foo').then(console.log)
// {value: {foo: 'bar'}, created: 123456789, cache: 'hit', TTL: 86400000}
```

#### Using promises
```js
cache.get('key', {
  ttl: 60000,               // in ms
  workerTimeout: 5000,
  deltaWait: 5000
}, Promise.resolve('hello').then(console.log)
// {value: 'hello', created: 123456789, cache: 'miss', TTL: 60000}
```

## Distributed capabilites
Distributed expire and persisting of cache misses to Redis are provided as
plugins using __function composition__ (or decorators), ie. extending the
in-memory cache cababilities. Thus is it possible to write your own plugins using pub/sub from rabbitMQ, persistence to file, hit/miss-ratio to external measurments systems and more.

#### Distributed expire
```js
import inMemoryCache from '@nrk/doublecache-as-promised'
import redisWrapper from '@nrk/doublecache-as-promised/lib/redis-wrapper'
import Redis from 'ioredis'

// server # 1 + 2
const cache = inMemoryCache({
  initial: {                    // initial state
    foo: 'bar'
  },                  
  maxLength: 1000,              // object count
  maxAge: 24 * 60 * 60 * 1000   // in ms
})

const redisFactory = () => new Redis(/* options */)

const distCache = redisWrapper(cache, redisFactory, 'namespace')
distCache.expire(['foo'])
setTimeout(() => {
  distCache.get('foo').then(console.log)
  // expired in server # 1 + 2
  // {value: {foo: 'bar'}, created: 123456789, cache: 'stale', TTL: 86400000}
}, 1000)
```

#### Persisting cache misses
```js
import inMemoryCache from '@nrk/doublecache-as-promised'
import redisWrapper from '@nrk/doublecache-as-promised/lib/redis-wrapper'
import redisPersistenceWrapper from '@nrk/doublecache-as-promised/lib/redis-persistence-wrapper'
import Redis from 'ioredis'

const cache = inMemoryCache({
  initial: {                    // initial state
    foo: 'bar'
  },                  
  maxLength: 1000,              // object count
  maxAge: 24 * 60 * 60 * 1000   // in ms
})

const redisFactory = () => new Redis(/* options */)
const distCache = redisWrapper(cache, redisFactory, 'namespace')

const distPeristCache = createCacheInstance(
  distCache,
  redisFactory,
  {
    keySpace: 'myCache',        // key prefix used when storing in redis
    expire: 60 * 60             // auto expire unused keys after xx seconds
  }
)

distPersistCache.load()         // load previous data from redis into local cache

cacheInstance.expire(['foo'])   // supports distributed expire as well, using redisWrapper
cache.get('key', {              // will store a key in redis, using key: myCache-<timestamp><key>
  ttl: 60000,                   // in ms
  workerTimeout: 5000,
  deltaWait: 5000
}, Promise.resolve('hello').then(console.log)
// {value: 'hello', created: 123456789, cache: 'miss', TTL: 60000}
```

---

## Local development
First clone the repo and install its dependencies:

```bash
git clone git@github.com:nrkno/doublecache-as-promised.git
cd doublecache-as-promised
npm install && npm run build && npm run test
```

## Building and committing
After having applied changes, remember to build and run tests before pushing the changes upstream.

```bash
git checkout -b feature/my-changes
# update the source code
npm run build
git commit -am "Add my changes"
git push origin feature/my-changes
# then make a PR to the master branch,
# and assign another developer to review your code
```

> NOTE! Please also make sure to keep commits small and clean (that the commit message actually refers to the updated files).  
> Stylistically, make sure the commit message is **Capitalized** and **starts with a verb in the present tense** (for example `Add minification support`).
