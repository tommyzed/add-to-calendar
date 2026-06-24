const { performance } = require('perf_hooks');

function testUnoptimized() {
    const start = performance.now();
    for (let i = 0; i < 100000; i++) {
        const event = {
            start: {
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            end: {
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
        };
    }
    const end = performance.now();
    return end - start;
}

function testOptimized() {
    const start = performance.now();
    for (let i = 0; i < 100000; i++) {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const event = {
            start: {
                timeZone,
            },
            end: {
                timeZone,
            },
        };
    }
    const end = performance.now();
    return end - start;
}

const unoptimizedTime = testUnoptimized();
const optimizedTime = testOptimized();

console.log(`Unoptimized Time: ${unoptimizedTime.toFixed(2)} ms`);
console.log(`Optimized Time: ${optimizedTime.toFixed(2)} ms`);
console.log(`Improvement: ${((unoptimizedTime - optimizedTime) / unoptimizedTime * 100).toFixed(2)}%`);
