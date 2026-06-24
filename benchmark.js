import dayjs from 'dayjs';

const start_datetime = '2023-10-01T10:00:00';
const end_datetime = '2023-10-01T11:00:00';

const iterations = 100000;

console.time('Baseline (Parsing on every render)');
for (let i = 0; i < iterations; i++) {
  const start = start_datetime ? dayjs(start_datetime) : null;
  const end = end_datetime ? dayjs(end_datetime) : null;
}
console.timeEnd('Baseline (Parsing on every render)');

const cachedStart = start_datetime ? dayjs(start_datetime) : null;
const cachedEnd = end_datetime ? dayjs(end_datetime) : null;

console.time('Optimized (Using cached dayjs objects)');
for (let i = 0; i < iterations; i++) {
  const start = cachedStart;
  const end = cachedEnd;
}
console.timeEnd('Optimized (Using cached dayjs objects)');
