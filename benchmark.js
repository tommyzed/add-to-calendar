const text = "```json\n{ \"summary\": \"test\", \"start_datetime\": \"2024-01-01T12:00:00Z\", \"location\": \"New York\", \"description\": \"A description of the event.\" }\n```";

function unoptimized(input) {
    return input.replace(/```json/g, '').replace(/```/g, '').trim();
}

const REGEX_JSON = /```json/g;
const REGEX_ALL = /```/g;

function optimized(input) {
    return input.replace(REGEX_JSON, '').replace(REGEX_ALL, '').trim();
}

const iterations = 10000000;

const startUnoptimized = performance.now();
for (let i = 0; i < iterations; i++) {
    unoptimized(text);
}
const endUnoptimized = performance.now();
console.log(`Unoptimized: ${endUnoptimized - startUnoptimized} ms`);

const startOptimized = performance.now();
for (let i = 0; i < iterations; i++) {
    optimized(text);
}
const endOptimized = performance.now();
console.log(`Optimized: ${endOptimized - startOptimized} ms`);
