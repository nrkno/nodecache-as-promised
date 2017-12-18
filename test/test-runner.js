/* eslint no-console: 0 */
const chalk = require('chalk')
const fs = require('fs')
const {THRESHOLD, log} = require('./log')
const ROUNDS = 10

const getIterations = (max, i, rounds) => {
  return Math.round(max * Math.sin(i * (90 / rounds) * Math.PI / 180)) || 1
}

module.exports = ({perfTest, fileToParse, max, rounds = ROUNDS}) => {
  const fileSize = fs.statSync(fileToParse).size / 1024;  // eslint-disable-line

  console.log(`${process.send ? `Process: ${process.pid}` : ''}
    Running ${chalk.yellow(perfTest.name)}
    Using ${chalk.blue(fileToParse)} with ~${Math.round(fileSize)}kb weight
    Threshold: ${chalk.green(`Below ${THRESHOLD}ms`)}. ${chalk.red(`Above ${THRESHOLD}ms`)}`);
  [...Array(rounds + 1)]
    .map((v, i) => () => perfTest(getIterations(max, i, rounds)).then(log))
    .reduce((prev, cur) => {
      return prev.then(() => cur())
    }, Promise.resolve({}))
      .then(() => console.log(`completed testing ${max} * sin(0..90)`)) // eslint-disable-line
      .catch((err) => {
        console.error(err); // eslint-disable-line
        throw err
      })
}
