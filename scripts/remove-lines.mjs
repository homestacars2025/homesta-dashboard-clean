import { readFileSync, writeFileSync } from 'fs';

const filePath = '/app/dashboard/availability/page.tsx';
const lines = readFileSync(filePath, 'utf-8').split('\n');

// Remove lines 952-1455 (0-indexed: 951-1454)
const before = lines.slice(0, 951);
const after = lines.slice(1455);

const result = before.concat(after).join('\n');
writeFileSync(filePath, result, 'utf-8');

console.log(`Removed ${1455 - 951} lines (952-1455). File now has ${before.length + after.length} lines.`);
