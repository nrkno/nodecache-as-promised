/* eslint no-console: 0 */
const chalk = require('chalk')
const fs = require('fs')
const {THRESHOLD, log} = require('./log')
const ROUNDS = 10

const getSinIterations = (max, i, rounds) => {
  return Math.round(max * Math.sin(i * (90 / rounds) * Math.PI / 180)) || 1
}

const getLinearIterations = (max, i, rounds) => {
  return Math.round((i / rounds) * max) || 1
}

const iterationTypes = {
  linear: getLinearIterations,
  sin: getSinIterations
}

const getLabel = (type, max) => {
  if (type === 'sin') {
    return `sin(0..90) * ${max}`
  }
  return `linear(0..${max})`
}

module.exports = ({perfTest, fileToParse, max, rounds = ROUNDS, type = 'sin'}) => {
  const fileSize = fs.statSync(fileToParse).size / 1024;  // eslint-disable-line
  if (!iterationTypes[type]) {
    throw new TypeError(`unsupported ${type}. Must be one of ${Object.keys(iterationTypes).join(', ')}`)
  }

  console.log(`${process.send ? `Process: ${process.pid}` : ''}
    Running ${chalk.yellow(perfTest.name)}
    Using ${chalk.blue(fileToParse)} with ~${Math.round(fileSize)}kb weight
    Threshold: ${chalk.green(`Below ${THRESHOLD}ms`)}. ${chalk.red(`Above ${THRESHOLD}ms`)}`);
  [...Array(rounds + 1)]
    .map((v, i) => () => perfTest(iterationTypes[type](max, i, rounds)).then(log))
    .reduce((prev, cur) => {
      return prev.then(() => cur())
    }, Promise.resolve({}))
      .then(() => console.log(`completed testing ${max} * ${getLabel(type, max)}`)) // eslint-disable-line
      .catch((err) => {
        console.error(err); // eslint-disable-line
        throw err
      })
}
