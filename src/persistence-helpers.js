import isUndefined from 'lodash/isUndefined'
import isNull from 'lodash/isNull'
import isBoolean from 'lodash/isBoolean'
import isNumber from 'lodash/isNumber'
import isString from 'lodash/isString'
import isArray from 'lodash/isArray'
import isPlainObject from 'lodash/isPlainObject'

const MAX_PAGE_SIZE = 100

export const createRegExp = (key) => {
  return new RegExp(`(${key}-)(\\d+)`)
}

export const deDup = (keys = [], regexp) => {
  const keyMap = new Map()
  keys.forEach((key) => {
    const score = key.match(regexp)[2]
    const current = key.replace(regexp, '$1')
    if (!keyMap.has(current) || keyMap.get(current).score < score) {
      keyMap.set(current, {
        key,
        score
      })
    }
  })
  return Array.from(keyMap).map(([current]) => {
    return keyMap.get(current).key
  })
}

export const sortKeys = (keys, regexp) => {
  return keys.sort((a, b) => {
    const aKeyWithDate = a.match(regexp)[2]
    const bKeyWithDate = b.match(regexp)[2]
    if (aKeyWithDate < bKeyWithDate) {
      return -1
    }
    if (aKeyWithDate > bKeyWithDate) {
      return 1
    }
    return 0
  })
}

export const deleteKeys = (keys, redisClient) => {
  const p = []
  keys.forEach((key) => {
    p.push(new Promise((resolve, reject) => {
      redisClient.del(key, (err, res) => {
        if (err) {
          reject(err)
          return
        }
        resolve(res)
      })
    }))
  })
  return Promise.all(p).then(() => {
    return keys
  })
}

export const readKeys = (keys, redisClient, log) => {
  if (keys.length === 0) {
    return Promise.resolve({})
  }
  return new Promise((resolve) => {
    const p = []
    for (let i = 0; i < keys.length; i = i + MAX_PAGE_SIZE) {
      const keysToRead = keys.slice(i, i + MAX_PAGE_SIZE)
      p.push(new Promise((resolve) => {
        redisClient.mget(keysToRead, (err, results) => {
          if (err) {
            log.warn(`could not read keys into cache, reason: ${err}`)
            resolve({})
            return
          }
          resolve(keysToRead.reduce((acc, key, i) => {
            try {
              acc[key] = JSON.parse(results[i])
            } catch (e) {
              log.warn(`could not parse value for ${key} as JSON. ${results[i]}`)
            }
            return acc
          }, {}))
        })
      }))
    }
    return Promise.all(p).then((results) => {
      resolve(results.reduce((acc, next) => {
        Object.assign(acc, next)
        return acc
      }, {}))
    })
  })
}

export const syncCacheWithRedis = ({keys, regexp, maxLength, redisClient, log}) => {
  const sortedKeysByDate = sortKeys(deDup(keys, regexp), regexp)
  const keysToFetch = sortedKeysByDate.slice(0, maxLength)
  const keysToDelete = sortedKeysByDate.slice(maxLength)
  return Promise.all([
    deleteKeys(keysToDelete, redisClient),
    readKeys(keysToFetch, redisClient, log)
  ])
}

export const scanKeys = (redisClient, cacheKeyPrefix) => {
  const keys = []
  return new Promise((resolve, reject) => {
    const stream = redisClient.scanStream({
      match: `${cacheKeyPrefix}*`,
      count: 100
    })
    stream.on('data', (resultKeys) => {
      keys.push(...resultKeys)
    })
    stream.on('end', () => {
      resolve(keys)
    })
    stream.on('error', (err) => {
      reject(err)
    })
  })
}

// credits to https://stackoverflow.com/users/128816/treznik
// https://stackoverflow.com/questions/30579940/reliable-way-to-check-if-objects-is-serializable-in-javascript
export const isSerializable = (obj) => {
  if (isUndefined(obj) ||
      isNull(obj) ||
      isBoolean(obj) ||
      isNumber(obj) ||
      isString(obj)) {
    return true
  }

  if (!isPlainObject(obj) &&
      !isArray(obj)) {
    return false
  }

  for (var key in obj) {
    if (!isSerializable(obj[key])) {
      return false
    }
  }

  return true
}
