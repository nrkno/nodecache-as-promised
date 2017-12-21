export const mockRedisFactory = (overrideMethods = {}) => {
  let instance
  return () => {
    const cbs = {}
    const namespaces = []
    const cache = {}
    if (instance) {
      return instance
    }
    instance = Object.assign({
      subscribe: (ns) => {
        namespaces.push(ns)
      },
      set: (key, value, cb) => {
        cache[key] = value
        cb(null, '')
      },
      mget: (keys, cb) => {
        cb(null, Object.keys()
          .filter((key) => keys.indexOf(key))
          .map((key) => cache[key])
        )
      },
      del: (key, cb) => {
        delete cache[key]
        cb(null, '')
      },
      publish: (ns, data) => {
        (cbs[ns] || []).forEach((cb) => cb(ns, data))
      },
      on: (event, cb) => {
        namespaces.forEach((ns) => {
          if (!cbs[ns]) {
            cbs[ns] = []
          }
          cbs[ns].push(cb)
        })
      }
    }, overrideMethods)
    return instance
  }
}
