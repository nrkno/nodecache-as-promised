const fs = require('fs');
const path = require('path');
const testRunner = require('./test-runner');
const argv = require('yargs').argv;
const type = argv.type || 'sin';

const fileToParse = path.join(__dirname, 'newsfeed.json');

const data = fs.readFileSync(fileToParse, 'utf-8'); // eslint-disable-line

const noCachePerfTest = (iterations) => {
  const now = Date.now();
  const promises = [];
  for (let i = 0; i < iterations; i++) {
    promises.push(Promise.resolve(JSON.parse(data)));
  }
  return Promise.all(promises).then(() => ({ used: Date.now() - now, iterations }));
};

testRunner({ perfTest: noCachePerfTest, fileToParse, rounds: 30, max: 1500, type });
