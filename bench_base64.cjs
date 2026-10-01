const { performance } = require('perf_hooks');

const makeDataURL = (sizeMb) => {
  const prefix = "data:image/jpeg;base64,";
  const chunk = "aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789+/";
  let data = prefix;
  const targetLength = sizeMb * 1024 * 1024;
  while (data.length < targetLength) {
    data += chunk;
  }
  return data.substring(0, targetLength);
}

const runBench = () => {
  const data = makeDataURL(10); // 10MB
  console.log("Data size:", data.length);

  const iterations = 100;

  let start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const _ = data.split(',')[1];
  }
  const splitTime = performance.now() - start;

  start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const index = data.indexOf(',');
    const _ = index !== -1 ? data.substring(index + 1) : data;
  }
  const substringTime = performance.now() - start;

  console.log(`split() time: ${splitTime.toFixed(2)}ms`);
  console.log(`indexOf() + substring() time: ${substringTime.toFixed(2)}ms`);
  console.log(`Improvement: ${((splitTime - substringTime) / splitTime * 100).toFixed(2)}% faster`);
}

runBench();
