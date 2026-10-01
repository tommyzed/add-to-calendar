const { performance } = require('perf_hooks');
const { GoogleGenerativeAI } = require('@google/generative-ai');

function benchmark() {
  const apiKey = 'test-key-just-for-benchmarking';
  const modelName = 'gemini-3.7-flash';

  const ITERS = 10000;

  // 1. Baseline: Instantiating both GenAI and Model every time
  let start = performance.now();
  for (let i = 0; i < ITERS; i++) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });
  }
  let end = performance.now();
  console.log(`Baseline (no caching) time for ${ITERS} iterations: ${(end - start).toFixed(2)} ms`);

  // 2. Cached instance
  let cachedGenAI = null;
  let cachedModel = null;

  start = performance.now();
  for (let i = 0; i < ITERS; i++) {
    if (!cachedGenAI) {
      cachedGenAI = new GoogleGenerativeAI(apiKey);
      cachedModel = cachedGenAI.getGenerativeModel({ model: modelName });
    }
    const model = cachedModel;
  }
  end = performance.now();
  console.log(`Optimized (cached instance) time for ${ITERS} iterations: ${(end - start).toFixed(2)} ms`);
}

benchmark();
