const {fork} = require('child_process')
const cpuCount = require('os').cpus().length
const path = require('path')
const {log} = require('./log')

const worker = path.join(__dirname, 'cache.js')

const stats = {}

console.log(`Starting forked cache, using ${cpuCount} cpus`); // eslint-disable-line

const promises = []

for (let i = 0; i < cpuCount; i++) {
  const p = new Promise((resolve) => {
    const child = fork(worker)
    child.on('message', ({used, iterations}) => {
      if (!stats[iterations]) {
        stats[iterations] = []
      }
      stats[iterations].push(used)
    })
    child.on('exit', resolve)
  })
  promises.push(p)
}

Promise.all(promises).then(() => {
  const keys = Object.keys(stats)
  const processed = keys.map((stat) => {
    return {
      iterations: stat * stats[stat].length,
      used: stats[stat].reduce((a, b) => Math.max(a, b))
    }
  })
  processed.forEach(({used, iterations}) => {
    log({used, iterations})
  })
}).catch((err) => {
  console.error(err); // eslint-disable-line
  throw err
})
