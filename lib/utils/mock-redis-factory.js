"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
const mockRedisFactory = exports.mockRedisFactory = (overrideMethods = {}, { events = {} } = {}) => {
  let instance;
  return () => {
    const cbs = {};
    const namespaces = [];
    if (instance) {
      return instance;
    }
    instance = Object.assign({
      subscribe: ns => {
        namespaces.push(ns);
      },
      publish: (ns, data) => {
        (cbs[ns] || []).forEach(cb => cb(ns, data));
      },
      on: (event, cb) => {
        namespaces.forEach(ns => {
          if (!cbs[ns]) {
            cbs[ns] = [];
          }
          cbs[ns].push(cb);
        });
      },
      scanStream: ({ match, cound }) => {
        return {
          on: (event, cb) => {
            if (!events[event]) {
              events[event] = [];
            }
            events[event].push(cb);
          }
        };
      }

    }, overrideMethods);
    return instance;
  };
};