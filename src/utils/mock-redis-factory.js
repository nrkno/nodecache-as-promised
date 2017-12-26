export const mockRedisFactory = (overrideMethods = {}) => {
  let instance
  return () => {
    const cbs = {}
    const namespaces = []
    if (instance) {
      return instance
    }
    instance = Object.assign({
      subscribe: (ns) => {
        namespaces.push(ns)
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
