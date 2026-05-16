#!/usr/bin/env node
/**
 * ASCII preview of the Labyrinthos catacombs generator.
 *
 * Usage:
 *   node tools/preview-catacombs.mjs [algorithm] [width] [height]
 *
 * Examples:
 *   node tools/preview-catacombs.mjs
 *   node tools/preview-catacombs.mjs RecursiveBacktrack 41 17
 */
import labyrinthos from 'labyrinthos';

const algorithm = process.argv[2] ?? 'RecursiveDivision';
const width  = parseInt(process.argv[3] ?? '30', 10);
const height = parseInt(process.argv[4] ?? '20', 10);

const tm = new labyrinthos.TileMap({ width, height });
if (algorithm === 'RecursiveDivision') tm.fill(0);
else tm.fill(1);

const fn = labyrinthos.mazes[algorithm];
if (!fn) {
  console.error(`Unknown algorithm: ${algorithm}`);
  console.error(`Available: ${Object.keys(labyrinthos.mazes).join(', ')}`);
  process.exit(2);
}
fn(tm, {});

const data = Array.isArray(tm.data[0]) ? tm.data.flat() : tm.data;

console.log(`--- ${algorithm} ${width}x${height} ---`);
for (let y = 0; y < height; y++) {
  let row = '';
  for (let x = 0; x < width; x++) {
    row += data[y * width + x] === 1 ? '#' : '.';
  }
  console.log(row);
}
