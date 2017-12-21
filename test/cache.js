const fs = require('fs')
const path = require('path')
const readFileAsync = require('util').promisify(fs.readFile)
const testRunner = require('./test-runner')
const {default: createCacheInstance} = require('../lib')
const argv = require('yargs').argv
const type = argv.type || 'sin'

const fileToParse = path.join(__dirname, 'newsfeed.json')

const ciOptions = { log: console, initial: {}, maxLength: 100, maxAge: 120 * 1000 }
const workerOptions = { ttl: 60 * 1000, workerTimeout: 5 * 1000, deltaWait: 5 * 1000 }

const ci = createCacheInstance(ciOptions)

const cachePerfTest = (iterations) => {
  const now = Date.now()
  const promises = []
  for (let i = 0; i < iterations; i++) {
    promises.push(ci.get(fileToParse, workerOptions, () => {
      return readFileAsync(fileToParse, 'utf-8').then((data) => JSON.parse(data))
    }))
  }
  return Promise.all(promises).then(() => ({ used: Date.now() - now, iterations }))
}

testRunner({perfTest: cachePerfTest, fileToParse, rounds: 15, max: 2400000, type})
