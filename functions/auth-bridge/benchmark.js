const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = 'test-api-key';
const modelName = 'gemini-1.5-flash';

function runWithoutCache(iterations) {
    const start = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });
    }
    const end = process.hrtime.bigint();
    return Number(end - start) / 1e6; // in ms
}

function runWithCache(iterations) {
    let cachedGenAI = null;
    let cachedModel = null;

    const start = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) {
        if (!cachedGenAI) {
            cachedGenAI = new GoogleGenerativeAI(apiKey);
            cachedModel = cachedGenAI.getGenerativeModel({ model: modelName });
        }
        const model = cachedModel;
    }
    const end = process.hrtime.bigint();
    return Number(end - start) / 1e6; // in ms
}

const ITERATIONS = 10000;
console.log(`Running benchmark with ${ITERATIONS} iterations...`);
console.log(`Without Cache: ${runWithoutCache(ITERATIONS)} ms`);
console.log(`With Cache: ${runWithCache(ITERATIONS)} ms`);
