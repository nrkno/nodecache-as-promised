# @nrk/doublecache-as-promised

> Fast and resilient cache for NodeJs targeting high-volume sites

- [Installing](#installing)
- [Features](#features)
- [APIs](#apis)
- [Examples](#examples)
- [Distributed capabilites](#distributed-capabilites)
- [Local development](#local-development)
- [Building and committing](#building-and-committing)

## Installing

```
npm install @nrk/doublecache-as-promised --save
```

## Motivation
Sometimes Node.js needs to do some heavy lifting, performing CPU or network intensive tasks and yet respond quickly on incoming requests. For repetitive tasks like Server side rendering of markup or parsing big JSON responses caching can give the application a great performance boost. In addition - serving stale content when a backend resource is down may save your day! The intention of `doublecache-as-promised` is to give you a fairly simple, yet powerful application cache, with fine-grained control over caching behaviour.

`doublecache-as-promised` is inspired by how [Varnish](https://varnish-cache.org/) works. It is not intended to replace Varnish (but works great in combination). In general Varnish works great as an edge/burst/failover cache, in addition to reverse proxying and loadbalancing. There exists several other cache solutions on NPM, but they're often too basic or too attached to a combination of perquisites that does not fit all needs of an application cache.

### Features
- __In-memory cache__ is used as primary storage since it will always be faster than parsing and fetching data over network. An [LRU-cache](https://www.npmjs.com/package/lru-cache) is enabled to constrain the amount of memory used.
- __Persistent cache__ is used as secondary storage to avoid high back-pressure on backend resources when caches are cleared after server restarts. This is achieved storing cache-misses in Redis depending on a [ioredis](https://www.npmjs.com/package/ioredis)-factory
- __Caches are filled using (worker) promises__ since cached objects often are depending on async operations. (RxJs)[https://www.npmjs.com/package/rxjs] is used to queue concurrent requests for the same key; thus ensuring that only __one__ worker is performed when cached content is missing/stale.
- __Caching of custom class instances, functions and native objects__ such as Date, RegExp and redux stores are supported through in-memory caching. Non-serializable (using JSON.stringify) objects are filtered out in persistent caches though.
- __On demand expiry__ is supported using Redis pub/sub, so that new content may be available published before cache-TTL is reached.
- __Grace mode__ is used if a worker promise fails (eg. caused by failing backends), ie.  stale cache is returned instead.
- __Avoidance of spamming backend resources__ using a configurable retry-wait parameter, serving either a stale object or rejection.
- __Middleware support__ to create your own custom extensions

### Performance testing

Parsing a json-file at around 47kb (file contents are cached at startup). Using a Macbook pro, mid 2015, 16gb ram, i7 CPU.

<p align="left">
  <img src="./test/linear-perftest-nocache.jpeg?raw=true" width="50%"/>
</p>

The image shows graph from running the test script `perf:nocache-cache-file -- --type=linear`. At around 1300 iterations the event loop starts lagging, and at around 1500 iterations the process stops responding. It displays that even extremely optimized JSON.parse could be a bottleneck when fetching remote data for rendring. (`React.render` would be even slower)

<p align="left">
  <img src="./test/linear-perftest-cache.jpeg?raw=true" width="50%"/>
</p>

The second image is a graph from running test script `perf:cache -- --type=linear`. At around 3.1 million iterations the event loop starts lagging, and at around 3.4 million iterations the process runs out of memory and crashes. The graph has no relation to how fast JSON.parse is, but what speed is achievable by skipping it altogether (ie. `Promise`-processing)

## APIs
Create a new `inMemoryCache` instance using a factory method. This instance may be extended by the `distCache` and/or `persistentCache` middlewares (`.use(..)`).

### inMemoryCache factory
Creating a new instance

```js
import inMemoryCache from '@nrk/doublecache-as-promised'
const cache = inMemoryCache(options)
```

#### options
An object containing configuration
- initial - `Object`. Initial key/value set to prefill cache. Default: `{}`
- maxLength - `Number`. Max key count before LRU-cache evicts object. Default: `1000`
- maxAge - `Number`. Max time before a (stale) key is evicted by LRU-cache (in ms). Default: `172800000` (48h)
- log - `Object with log4j-facade`. Used to log internal work. Default: `console`

### distCache factory
Creating a new distCache middleware instance

```js
import cache, {distCache} from '@nrk/doublecache-as-promised'
const cache = inMemoryCache()
cache.use(distCache(redisFactory, namespace))
```

#### Parameters
Parameters that must be provided upon creation:
- redisFactory - `Function`. A function that returns an ioredis compatible redisClient.
- namespace - `String`. Pub/sub-namespace used for distributed expiries

### persistentCache factory
Creating a new persistentCache middleware instance

```js
import cache, {persistentCache} from '@nrk/doublecache-as-promised'
const cache = inMemoryCache()
cache.use(persistentCache(redisFactory, options))
```

#### Parameters
Parameters that must be provided upon creation:
- redisFactory - `Function`. A function that returns an ioredis compatible redisClient.

#### options
- doNotPersist - `RegExp`. Keys matching this regexp is not persisted to cache. Default `null`
- keySpace - `String`. Prefix used when storing keys in redis.
- grace - `Number`. Used to calculate TTL in redis (before auto removal), ie. object.TTL + grace. Default `86400000` (24h)
- bootload - `Boolean`. Flag to choose if persisted cache is loaded from redis on middleware creation. Default `true`

### Instance methods
When the factory is created (with or without middlewares), the following methods may be used.

#### .get(key, config?, fnReturningPromise?)
Get an item from the cache.
```js
const value = cache.get('myKey')
  .then(({value}) => {
    console.log(value)
  })
```

Get an item from the cache, or fill cache with data returned by promise using config (on cache MISS, ie. stale or cold cache)
```js
cache.get('myKey', options, () => promise)
  .then(({value}) => {
    console.log(value)
  })
```
#### options
Configuration for the newly created object
- ttl - `Number`. Ttl (in ms) before cached object becomes stale. Default: `86400000` (24h)
- workerTimeout - `Number`. max time allowed to run promise. Default: `5000`
- deltaWait - `Number`. delta wait (in ms) before retrying promise, when stale. Default: `10000`

#### .set(key, value, ttl)
Set a new cache value with ttl
```js
// set a cache value that becomes stale after 1 minute
cache.set('myKey', 'someData', 60 * 1000)
```

#### .expire(keys)
Mark keys as stale
```js
cache.expire(['myKey*', 'anotherKey'])
```

#### .addDisposer(callback)
Add callback to be called when an item is evicted by LRU-cache. Used to do cleanup
```js
const cb = (key, value) => cleanup(key, value)
cache.addDisposer(cb)
```

#### .removeDisposer(callback)
Remove callback attached to LRU-cache
```js
cache.removeDisposer(cb)
```

## Examples
*Note! These examples are written using ES2015 syntax. The lib is exported using Babel as CJS modules*

### Basic usage
```js
import inMemoryCache from '@nrk/doublecache-as-promised'
const cache = inMemoryCache({ /* options */})

// imiplicit set cache on miss, or use cached value
cache.get('key', {/* options */}, () => Promise.resolve({hello: 'world'}))
  .then((data) => {
    console.log(data)
    // {
    //   value: {
    //     hello: 'world'
    //   },
    //   created: 123456789,
    //   cache: 'miss',
    //   TTL: 86400000
    // }
  })
```

### Basic usage with options
```js
import inMemoryCache from '@nrk/doublecache-as-promised';

const cache = inMemoryCache({
  initial: {                    // initial state
    foo: 'bar'
  },                            
  maxLength: 1000,              // LRU max object count
  maxAge: 24 * 60 * 60 * 1000   // LRU max age in ms
})
// set/overwrite cache key
cache.set('key', {hello: 'world'})
// imiplicit set cache on miss, or use cached value
cache.get('anotherkey', {
  ttl: 60 * 1000,               // TTL for cached object, in ms
  workerTimeout: 5 * 1000,      // worker timeout, in ms
  deltaWait: 5 * 1000           // wait time, if worker fails
}, () => Promise.resolve({hello: 'world'}))
  .then((data) => {
    console.log(data)
    // {
    //   value: {
    //     hello: 'world'
    //   },
    //   created: 123456789,
    //   cache: 'miss',
    //   TTL: 86400000
    // }
  })
```

### Distributed capabilites
Distributed expire and persisting of cache misses to Redis are provided as middlewares, ie. wrapping the in-memory cache with a factory that intercepts function calls. It should therefore be easy to write your own middlewares using pub/sub from rabbitMQ, zeroMQ, persisting to a NAS, hit/miss-ratio to external measurments systems and more.

#### Distributed expire
```js
import inMemoryCache, {distCache} from '@nrk/doublecache-as-promised'
import Redis from 'ioredis'

// a factory function that returns a redisClient
const redisFactory = () => new Redis(/* options */)
const cache = inMemoryCache({initial: {fooKey: 'bar'}})
cache.use(distCache(redisFactory, 'namespace'))
// publish to redis (using wildcard)
cache.expire(['foo*'])
setTimeout(() => {
  cache.get('fooKey').then(console.log)
  // expired in server # 1 + 2
  // {value: {fooKey: 'bar'}, created: 123456789, cache: 'stale', TTL: 86400000}
}, 1000)
```

#### Persisting cache misses
```js
import inMemoryCache, {persistentCache} from '@nrk/doublecache-as-promised'
import Redis from 'ioredis'

const redisFactory = () => new Redis(/* options */)
const cache = inMemoryCache({/* options */})
cache.use(persistentCache(
  redisFactory,
  {
    keySpace: 'myCache',   // key prefix used when storing in redis
    grace: 60 * 60         // auto expire unused keys in Redis after TTL + grace seconds
  }
))

cache.get('key', {/* options */}, () => Promise.resolve('hello'))
// will store a key in redis, using key: myCache-<key>
// {value: 'hello', created: 123456789, cache: 'hit', TTL: 60000}
```

#### Persisting cache misses __and__ distributed expire
```js
import inMemoryCache, {distCache, persistenCache} from '@nrk/doublecache-as-promised'
import Redis from 'ioredis'

const redisFactory = () => new Redis(/* options */)
const cache = inMemoryCache({/* options */})
cache.use(distCache(redisFactory, 'namespace'))
cache.use(persistenCache(
  redisFactory,
  {
    keySpace: 'myCache',   // key prefix used when storing in redis
    grace: 60 * 60         // auto expire unused keys in Redis after TTL + grace seconds
  }
))

cache.expire(['foo*'])  // distributed expire of all keys starting with foo
cache.get('key', {
  ttl: 60000,                       // in ms
  workerTimeout: 5000,
  deltaWait: 5000
}, () => Promise.resolve('hello')).then(console.log)
// will store a key in redis, using key: myCache-<key>
// {value: 'hello', created: 123456789, cache: 'miss', TTL: 60000}
```

---

## Local development
First clone the repo and install its dependencies:

```bash
git clone git@github.com:nrkno/doublecache-as-promised.git
git checkout -b feature/my-changes
cd doublecache-as-promised
npm install && npm run build && npm run test
```

## Building and committing
After having applied changes, remember to build and run/fix tests before pushing the changes upstream.

```bash
# update the source code
npm run build
git commit -am "Add my changes"
git push origin feature/my-changes
# then make a PR to the master branch,
# and assign another developer to review your code
```

> NOTE! Please make sure to keep commits small and clean (that the commit message actually refers to the updated files). Stylistically, make sure the commit message is **Capitalized** and **starts with a verb in the present tense** (eg. `Add minification support`).

## License

MIT © [NRK](https://www.nrk.no)
