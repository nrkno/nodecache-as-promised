/**
 * @module
 **/
import {
  isFresh,
  createRegExp
} from './cache-helpers'

export const buildKey = ({key, value, waiting, full}) => {
  const expire = value.created + value.TTL
  const expireKey = expire < Date.now() ? 'expired' : 'expires'
  return Object.assign({
    key,
    created: new Date(value.created),
    [expireKey]: new Date(expire)
  },
  waiting ? {
    waiting: {
      started: new Date(waiting.started),
      wait: waiting.wait,
      waitUntil: new Date(waiting.waitUntil)
    }
  } : {},
  full ? {value: value.value} : {})
}

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
    const keyInfo = buildKey({key, value, waiting: waiting.get(key), full})
    if (isFresh(value)) {
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
