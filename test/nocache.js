const fs = require('fs');
const path = require('path');
const readFileAsync = require('util').promisify(fs.readFile);
const testRunner = require('./test-runner');

const fileToParse = path.join(__dirname, 'newsfeed.json');

const noCachePerfTest = (iterations) => {
  const now = Date.now();
  const promises = [];
  for (let i = 0; i < iterations; i++) {
    promises.push(readFileAsync(fileToParse, 'utf-8').then((data) => JSON.parse(data)));
  }
  return Promise.all(promises).then(() => ({ used: Date.now() - now, iterations }));
};

testRunner({ perfTest: noCachePerfTest, fileToParse, max: 1000 });
