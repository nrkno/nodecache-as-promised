import {
  buildKey,
  existsAndNotStale,
  formatWait,
  createRegExp
} from './cache-helpers'

const extractProps = (obj) => {
  const ret = {}
  Object.keys(obj)
    .filter((key) => !/^log$|^cache$|^waiting$/.test(key))
    .forEach((key) => {
      ret[key] = obj[key]
    })
  return ret
}

export const getCacheInfo = (info) => {
  const {
    full,
    search = '*',
    cache,
    maxAge,
    waiting
  } = info
  const keys = {
    stale: [],
    hot: []
  }
  const matcher = createRegExp(search)
  cache.forEach((value, key) => {
    if (!matcher.test(key)) {
      return
    }
    const keyInfo = buildKey({key, value, isWaiting: formatWait(waiting.get(key)), full})
    if (existsAndNotStale(value)) {
      keys.hot.push(keyInfo)
    } else {
      keys.stale.push(keyInfo)
    }
  })
  return {
    now: new Date(),
    ...extractProps(info),
    maxAge: `${maxAge / (1000 * 60 * 60)}h`,
    itemCount: cache.itemCount,
    keys
  }
}
