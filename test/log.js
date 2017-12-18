const chalk = require('chalk')
const THRESHOLD = 1000

const isMaster = !process.send

const log = ({used, iterations}) => {
  let iterLabel = iterations
  if (iterations > 999) {
    iterLabel = `${(iterations / 1000).toFixed(2)}k`
  }
  if (iterations > 999999) {
    iterLabel = `${(iterations / 1000000).toFixed(2)}m`
  }
  const usedLabel = chalk[used > THRESHOLD ? 'red' : 'green'](`${used}ms`)
  if (!isMaster) {
    // child process
    process.send({used, iterations})
  } else {
    console.log(`Used ${usedLabel} to parse ${iterLabel} iterations`);  // eslint-disable-line
  }
}

module.exports = {
  THRESHOLD,
  log
}
