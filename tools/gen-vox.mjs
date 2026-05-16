#!/usr/bin/env node
/**
 * Procedural MagicaVoxel (.vox) generator for Long Watch NPCs and enemies.
 *
 * Produces a simple voxel humanoid per character keyed by body/hair/eye colors
 * matching their CastDef / EnemyPreset. Output lands in public/models/<key>.vox
 * so the runtime threejs-vox-loader picks them up automatically.
 *
 * Format reference: https://github.com/ephtracy/voxel-model/blob/master/MagicaVoxel-file-format-vox.txt
 *
 * Replace these auto-generated stubs with hand-modeled .vox files anytime -
 * the loader doesn't care which made them.
 *
 * Usage: node tools/gen-vox.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'models');

// ---------------------------------------------------------------------------
// Character roster (mirrors src/cast.ts + src/enemy.ts + src/companion.ts)
// ---------------------------------------------------------------------------

const CHARACTERS = [
  // Cast
  { key: 'magrath',       bodyColor: 0x551533, hairColor: 0x221015, skin: 0xddaa88, eye: 0x88ccff, build: 'lithe' },
  { key: 'wallace',       bodyColor: 0x224455, hairColor: 0xddc88a, skin: 0xddaa88, eye: 0x6699cc, build: 'thin'  },
  { key: 'right_hand',    bodyColor: 0x553322, hairColor: 0x444444, skin: 0xccaa88, eye: 0x88aa66, build: 'broad' },
  { key: 'mira',          bodyColor: 0x88aa44, hairColor: 0xc8a070, skin: 0xeeb898, eye: 0x88aa44, build: 'heavy' },
  { key: 'aldous',        bodyColor: 0x222233, hairColor: 0xdddddd, skin: 0xddbb99, eye: 0x99aabb, build: 'thin'  },
  { key: 'penny',         bodyColor: 0x335566, hairColor: 0xb87333, skin: 0xeeccaa, eye: 0x66cc99, build: 'thin'  },
  { key: 'old_tom',       bodyColor: 0x556644, hairColor: 0xbbbbbb, skin: 0xbb9966, eye: 0x88aa44, build: 'broad' },
  // Companion
  { key: 'karla',         bodyColor: 0x884422, hairColor: 0xc8a070, skin: 0xddaa88, eye: 0x4488ff, build: 'broad' },
  // Enemies (humanoid stubs)
  { key: 'mook',          bodyColor: 0x334422, hairColor: 0x222222, skin: 0xaa8866, eye: 0xff3300, build: 'broad' },
  { key: 'fanatic',       bodyColor: 0x553311, hairColor: 0x553311, skin: 0xaa8866, eye: 0xff8800, build: 'thin'  },
  { key: 'priest',        bodyColor: 0x113355, hairColor: 0x113355, skin: 0xaa8866, eye: 0x66ccff, build: 'broad' },
  { key: 'crimson_angel', bodyColor: 0xaa1133, hairColor: 0x661122, skin: 0xeeccaa, eye: 0xff0066, build: 'lithe' },
  { key: 'sebek_ari',     bodyColor: 0x445533, hairColor: 0x553322, skin: 0x99aa66, eye: 0xffcc22, build: 'lithe' },
  { key: 'mezzoloth',     bodyColor: 0x553322, hairColor: 0x331100, skin: 0x664422, eye: 0xff4400, build: 'broad' },
  { key: 'air_elemental', bodyColor: 0x88aacc, hairColor: 0xaaccee, skin: 0xccddee, eye: 0xddeeff, build: 'lithe' },
  // Non-humanoid enemies stubbed for now - replace with hand-modeled .vox later
  { key: 'giant_toad',    bodyColor: 0x336622, hairColor: 0x224411, skin: 0x447733, eye: 0x88ff44, build: 'heavy' },
  { key: 'swarm_snakes',  bodyColor: 0x664422, hairColor: 0x553311, skin: 0x886633, eye: 0xddaa00, build: 'heavy' },
];

// ---------------------------------------------------------------------------
// Geometry templates
// ---------------------------------------------------------------------------

const GRID_X = 10;
const GRID_Y = 6;   // depth
const GRID_Z = 20;  // height (vertical in MagicaVoxel)

function fillBox(voxels, x0, y0, z0, x1, y1, z1, color) {
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        voxels.push({ x, y, z, c: color });
}

/**
 * Build a simple humanoid voxel figure.
 * Color slot indices (1-based in MagicaVoxel's palette[index-1]):
 *   1 = body, 2 = hair, 3 = skin, 4 = eye, 5 = boots, 6 = belt
 */
function buildHumanoid(profile) {
  const voxels = [];
  const { build } = profile;
  const shoulder = build === 'broad' ? 3 : build === 'heavy' ? 3 : 2;
  const waist    = build === 'heavy' ? 3 : 2;
  const torsoDepth = build === 'heavy' ? 3 : 2;
  const cx = Math.floor(GRID_X / 2);
  const cy = Math.floor(GRID_Y / 2);

  // Boots
  fillBox(voxels, cx - 1, cy - 1, 0, cx,     cy, 1, 5);
  // Legs
  fillBox(voxels, cx - 1, cy - 1, 2, cx - 1, cy, 7, 1);
  fillBox(voxels, cx,     cy - 1, 2, cx,     cy, 7, 1);
  // Belt
  fillBox(voxels, cx - waist, cy - 1, 8, cx + waist - 1, cy, 8, 6);
  // Torso
  fillBox(voxels,
    cx - shoulder, cy - Math.floor(torsoDepth / 2), 9,
    cx + shoulder - 1, cy - Math.floor(torsoDepth / 2) + torsoDepth - 1, 13, 1);
  // Arms
  fillBox(voxels, cx - shoulder - 1, cy - 1, 9, cx - shoulder - 1, cy, 13, 1);
  fillBox(voxels, cx + shoulder,     cy - 1, 9, cx + shoulder,     cy, 13, 1);
  // Neck
  fillBox(voxels, cx - 1, cy - 1, 14, cx, cy, 14, 3);
  // Head
  fillBox(voxels, cx - 2, cy - 2, 15, cx + 1, cy + 1, 18, 3);
  // Hair cap
  fillBox(voxels, cx - 2, cy - 2, 18, cx + 1, cy + 1, 19, 2);
  // Eyes (front face = lowest Y)
  voxels.push({ x: cx - 1, y: cy - 2, z: 16, c: 4 });
  voxels.push({ x: cx,     y: cy - 2, z: 16, c: 4 });

  return voxels;
}

// ---------------------------------------------------------------------------
// MagicaVoxel .vox binary writer
// ---------------------------------------------------------------------------

function rgba(hex, a = 255) {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff, a];
}

function buildPalette(profile) {
  const pal = new Array(256).fill(0).map(() => [0, 0, 0, 0]);
  pal[0] = rgba(profile.bodyColor);  // slot 1
  pal[1] = rgba(profile.hairColor);  // slot 2
  pal[2] = rgba(profile.skin);       // slot 3
  pal[3] = rgba(profile.eye);        // slot 4
  pal[4] = rgba(0x1a1208);           // slot 5 boots
  pal[5] = rgba(0x4a3014);           // slot 6 belt
  for (let i = 6; i < 256; i++) pal[i] = [128, 128, 128, 255];
  return pal;
}

function makeChunk(id, content, children = Buffer.alloc(0)) {
  const head = Buffer.alloc(12);
  head.write(id, 0, 4, 'ascii');
  head.writeUInt32LE(content.length, 4);
  head.writeUInt32LE(children.length, 8);
  return Buffer.concat([head, content, children]);
}

function writeVox(filePath, voxels, palette, size) {
  const sizeBuf = Buffer.alloc(12);
  sizeBuf.writeUInt32LE(size.x, 0);
  sizeBuf.writeUInt32LE(size.y, 4);
  sizeBuf.writeUInt32LE(size.z, 8);
  const sizeChunk = makeChunk('SIZE', sizeBuf);

  const xyziBuf = Buffer.alloc(4 + voxels.length * 4);
  xyziBuf.writeUInt32LE(voxels.length, 0);
  voxels.forEach((v, i) => {
    const off = 4 + i * 4;
    xyziBuf.writeUInt8(v.x, off);
    xyziBuf.writeUInt8(v.y, off + 1);
    xyziBuf.writeUInt8(v.z, off + 2);
    xyziBuf.writeUInt8(v.c, off + 3);
  });
  const xyziChunk = makeChunk('XYZI', xyziBuf);

  const rgbaBuf = Buffer.alloc(256 * 4);
  for (let i = 0; i < 256; i++) {
    const [r, g, b, a] = palette[i];
    rgbaBuf.writeUInt8(r, i * 4);
    rgbaBuf.writeUInt8(g, i * 4 + 1);
    rgbaBuf.writeUInt8(b, i * 4 + 2);
    rgbaBuf.writeUInt8(a, i * 4 + 3);
  }
  const rgbaChunk = makeChunk('RGBA', rgbaBuf);

  const childContent = Buffer.concat([sizeChunk, xyziChunk, rgbaChunk]);
  const mainChunk = makeChunk('MAIN', Buffer.alloc(0), childContent);

  const header = Buffer.alloc(8);
  header.write('VOX ', 0, 4, 'ascii');
  header.writeUInt32LE(150, 4);

  fs.writeFileSync(filePath, Buffer.concat([header, mainChunk]));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

fs.mkdirSync(OUT_DIR, { recursive: true });

let count = 0;
for (const profile of CHARACTERS) {
  const voxels = buildHumanoid(profile);
  const palette = buildPalette(profile);
  const outPath = path.join(OUT_DIR, `${profile.key}.vox`);
  writeVox(outPath, voxels, palette, { x: GRID_X, y: GRID_Y, z: GRID_Z });
  count++;
  console.log(`wrote ${outPath} (${voxels.length} voxels)`);
}
console.log(`\nDone. ${count} models in ${OUT_DIR}`);
