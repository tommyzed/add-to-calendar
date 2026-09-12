const { PerformanceObserver, performance } = require('perf_hooks');
const crypto = require('crypto');

// Mock getDb to simulate latency
let dbCalls = 0;
const mockDb = async () => {
  dbCalls++;
  return new Promise(resolve => setTimeout(resolve, 50)); // 50ms latency per query
};
mockDb.sql = true; // just to make it truthy if needed

async function logEventSequential(userId, eventType, metadata = {}, geo = {}) {
  try {
    const effectiveUserId = userId || 'anonymous';
    // 1. Append
    await mockDb();

    // 2. Upsert user
    if (effectiveUserId !== 'anonymous') {
      await mockDb();
    }
  } catch (err) {
    console.error('Error', err);
  }
}

async function logEventConcurrent(userId, eventType, metadata = {}, geo = {}) {
  try {
    const effectiveUserId = userId || 'anonymous';
    const queries = [];
    // 1. Append
    queries.push(mockDb());

    // 2. Upsert user
    if (effectiveUserId !== 'anonymous') {
      queries.push(mockDb());
    }

    await Promise.all(queries);
  } catch (err) {
    console.error('Error', err);
  }
}

async function runBenchmark() {
  console.log("Measuring Sequential logEvent...");
  let start = performance.now();
  await logEventSequential('user_123', 'login');
  let end = performance.now();
  console.log(`Sequential took: ${(end - start).toFixed(2)}ms`);

  console.log("Measuring Concurrent logEvent...");
  start = performance.now();
  await logEventConcurrent('user_123', 'login');
  end = performance.now();
  console.log(`Concurrent took: ${(end - start).toFixed(2)}ms`);
}

runBenchmark();
