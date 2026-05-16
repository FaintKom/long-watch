#!/usr/bin/env node
/**
 * Procedural MagicaVoxel (.vox) generator for Long Watch NPCs and enemies.
 *
 * v2 (Iter 36): taller Minecraft-proportion humanoids (8x4x32) with
 * character-specific accessories driven by `traits` (cape, scarf, hat,
 * apron, sabres, robe, etc). Each entry maps to a distinct silhouette.
 *
 * Format reference: https://github.com/ephtracy/voxel-model/blob/master/MagicaVoxel-file-format-vox.txt
 *
 * Usage: node tools/gen-vox.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'models');

// ---------------------------------------------------------------------------
// Roster - each entry picks a build template + per-character accessories.
// `traits` is a list of accessory keys consumed by addAccessory().
// ---------------------------------------------------------------------------

const CHARACTERS = [
  // Cast
  { key: 'magrath',       bodyColor: 0x551533, hairColor: 0x221015, skin: 0xddaa88, eye: 0x88ccff, accent: 0x882244, build: 'lithe', traits: ['cape', 'sabre_left', 'sabre_right', 'long_hair'] },
  { key: 'wallace',       bodyColor: 0x224455, hairColor: 0xddc88a, skin: 0xddaa88, eye: 0x6699cc, accent: 0x99bbcc, build: 'thin',  traits: ['messy_hair', 'cravat'] },
  { key: 'right_hand',    bodyColor: 0x553322, hairColor: 0x444444, skin: 0xccaa88, eye: 0x88aa66, accent: 0x882211, build: 'broad', traits: ['red_scarf', 'sash_dagger', 'beard'] },
  { key: 'mira',          bodyColor: 0x88aa44, hairColor: 0xc8a070, skin: 0xeeb898, eye: 0x88aa44, accent: 0xeeeeee, build: 'heavy', traits: ['apron', 'bun_hair'] },
  { key: 'aldous',        bodyColor: 0x222233, hairColor: 0xdddddd, skin: 0xddbb99, eye: 0x99aabb, accent: 0xffffff, build: 'thin',  traits: ['tailcoat', 'white_gloves', 'bald'] },
  { key: 'penny',         bodyColor: 0x335566, hairColor: 0xb87333, skin: 0xeeccaa, eye: 0x66cc99, accent: 0xffeedd, build: 'thin',  traits: ['apron_white', 'bun_hair', 'maid_cap'] },
  { key: 'old_tom',       bodyColor: 0x556644, hairColor: 0xbbbbbb, skin: 0xbb9966, eye: 0x88aa44, accent: 0x222222, build: 'broad', traits: ['hat', 'beard', 'shovel'] },
  // Companion
  { key: 'karla',         bodyColor: 0x884422, hairColor: 0xc8a070, skin: 0xddaa88, eye: 0x4488ff, accent: 0x442200, build: 'broad', traits: ['leather_vest', 'long_hair', 'sword_right'] },
  // Humanoid enemies
  { key: 'mook',          bodyColor: 0x334422, hairColor: 0x222222, skin: 0xaa8866, eye: 0xff3300, accent: 0x223311, build: 'broad', traits: ['hood', 'club_right'] },
  { key: 'fanatic',       bodyColor: 0x553311, hairColor: 0x553311, skin: 0xaa8866, eye: 0xff8800, accent: 0x331100, build: 'thin',  traits: ['robe', 'hood'] },
  { key: 'priest',        bodyColor: 0x113355, hairColor: 0x113355, skin: 0xaa8866, eye: 0x66ccff, accent: 0x4488cc, build: 'broad', traits: ['robe', 'hood', 'staff'] },
  { key: 'crimson_angel', bodyColor: 0xaa1133, hairColor: 0x661122, skin: 0xeeccaa, eye: 0xff0066, accent: 0xff4488, build: 'lithe', traits: ['cape', 'wings', 'sabre_left'] },
  { key: 'sebek_ari',     bodyColor: 0x445533, hairColor: 0x553322, skin: 0x99aa66, eye: 0xffcc22, accent: 0x223311, build: 'lithe', traits: ['robe', 'tail', 'staff'] },
  { key: 'mezzoloth',     bodyColor: 0x553322, hairColor: 0x331100, skin: 0x664422, eye: 0xff4400, accent: 0x884422, build: 'broad', traits: ['horns', 'sabre_left', 'sabre_right'] },
  { key: 'air_elemental', bodyColor: 0x88aacc, hairColor: 0xaaccee, skin: 0xccddee, eye: 0xddeeff, accent: 0xeeffff, build: 'lithe', traits: ['wisp_tail', 'glow_aura'] },
  // Non-humanoid (stubbed - humanoid silhouette w/ flavor)
  { key: 'giant_toad',    bodyColor: 0x336622, hairColor: 0x224411, skin: 0x447733, eye: 0x88ff44, accent: 0x224411, build: 'heavy', traits: ['squat', 'wide_mouth'] },
  { key: 'swarm_snakes',  bodyColor: 0x664422, hairColor: 0x553311, skin: 0x886633, eye: 0xddaa00, accent: 0x553311, build: 'heavy', traits: ['squat', 'tail'] },
];

// ---------------------------------------------------------------------------
// Geometry grid (Minecraft-ish proportions: 8 wide, 4 deep, 32 tall)
// ---------------------------------------------------------------------------

const GRID_X = 12;  // a bit of extra room for capes/wings
const GRID_Y = 6;
const GRID_Z = 32;

// Palette slot indices used by the builder. 1-based (palette[index-1]).
const SLOT = {
  body: 1,
  hair: 2,
  skin: 3,
  eye:  4,
  boot: 5,
  belt: 6,
  accent: 7,
  metal: 8,
  wood: 9,
  glow: 10,
};

function fillBox(voxels, x0, y0, z0, x1, y1, z1, color) {
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        voxels.push({ x, y, z, c: color });
}

function place(voxels, x, y, z, c) { voxels.push({ x, y, z, c }); }

/** Build the base humanoid (legs, torso, arms, neck, head). */
function buildBase(profile) {
  const voxels = [];
  const cx = Math.floor(GRID_X / 2);
  const cy = Math.floor(GRID_Y / 2);
  const { build } = profile;

  // Body proportions
  const shoulder = build === 'broad' ? 3 : build === 'heavy' ? 3 : 2;
  const waist    = build === 'heavy' ? 3 : 2;
  const torsoDepth = build === 'heavy' ? 3 : 2;
  const isSquat = build === 'heavy' && profile.traits.includes('squat');

  // Boots (z 0-2)
  fillBox(voxels, cx - 1, cy - 1, 0, cx,     cy, 2, SLOT.boot);

  // Legs
  const legTop = isSquat ? 8 : 13;
  fillBox(voxels, cx - 1, cy - 1, 3, cx - 1, cy, legTop, SLOT.body);
  fillBox(voxels, cx,     cy - 1, 3, cx,     cy, legTop, SLOT.body);

  // Belt
  fillBox(voxels, cx - waist, cy - 1, legTop + 1, cx + waist - 1, cy, legTop + 1, SLOT.belt);

  // Torso
  const torsoBottom = legTop + 2;
  const torsoTop = isSquat ? torsoBottom + 4 : torsoBottom + 7;
  fillBox(voxels,
    cx - shoulder, cy - Math.floor(torsoDepth / 2), torsoBottom,
    cx + shoulder - 1, cy - Math.floor(torsoDepth / 2) + torsoDepth - 1, torsoTop, SLOT.body);

  // Arms (slightly outside shoulders, full torso height)
  fillBox(voxels, cx - shoulder - 1, cy - 1, torsoBottom, cx - shoulder - 1, cy, torsoTop, SLOT.body);
  fillBox(voxels, cx + shoulder,     cy - 1, torsoBottom, cx + shoulder,     cy, torsoTop, SLOT.body);

  // Neck
  const neckZ = torsoTop + 1;
  fillBox(voxels, cx - 1, cy - 1, neckZ, cx, cy, neckZ, SLOT.skin);

  // Head (3-tall, slightly wider than torso)
  const headBottom = neckZ + 1;
  const headTop = headBottom + 3;
  fillBox(voxels, cx - 2, cy - 2, headBottom, cx + 1, cy + 1, headTop, SLOT.skin);

  // Eyes (front face = lowest Y)
  place(voxels, cx - 1, cy - 2, headBottom + 1, SLOT.eye);
  place(voxels, cx,     cy - 2, headBottom + 1, SLOT.eye);

  // Track key anchor heights for accessories.
  return { voxels, anchors: { torsoBottom, torsoTop, headBottom, headTop, neckZ, legTop, shoulder, cx, cy } };
}

/** Add accessory traits on top of the base humanoid. */
function addAccessories(voxels, anchors, profile) {
  const { torsoBottom, torsoTop, headBottom, headTop, neckZ, shoulder, cx, cy } = anchors;
  const traits = new Set(profile.traits);

  // ---- Hair / head coverings ----
  if (traits.has('bald')) {
    // skip hair entirely
  } else if (traits.has('hat')) {
    fillBox(voxels, cx - 3, cy - 3, headTop, cx + 2, cy + 2, headTop, SLOT.accent);     // brim
    fillBox(voxels, cx - 2, cy - 2, headTop + 1, cx + 1, cy + 1, headTop + 2, SLOT.accent); // crown
  } else if (traits.has('maid_cap')) {
    fillBox(voxels, cx - 2, cy - 2, headTop, cx + 1, cy + 1, headTop + 1, SLOT.accent);
  } else if (traits.has('hood')) {
    fillBox(voxels, cx - 3, cy - 3, headBottom - 1, cx + 2, cy + 2, headTop + 1, SLOT.accent);
    // carve face hollow
    fillBox(voxels, cx - 1, cy - 2, headBottom + 1, cx, cy - 2, headBottom + 2, SLOT.eye);
  } else if (traits.has('long_hair')) {
    fillBox(voxels, cx - 2, cy - 2, headTop, cx + 1, cy + 1, headTop + 1, SLOT.hair);
    fillBox(voxels, cx - 2, cy + 1, headBottom, cx + 1, cy + 1, headTop, SLOT.hair); // back
  } else if (traits.has('bun_hair')) {
    fillBox(voxels, cx - 2, cy - 2, headTop, cx + 1, cy + 1, headTop + 1, SLOT.hair);
    fillBox(voxels, cx - 1, cy + 1, headTop + 1, cx, cy + 1, headTop + 2, SLOT.hair);
  } else if (traits.has('messy_hair')) {
    fillBox(voxels, cx - 2, cy - 2, headTop, cx + 1, cy + 1, headTop + 1, SLOT.hair);
    place(voxels, cx - 2, cy - 2, headTop + 1, SLOT.hair);
    place(voxels, cx + 1, cy + 1, headTop + 1, SLOT.hair);
  } else {
    // default short cap
    fillBox(voxels, cx - 2, cy - 2, headTop, cx + 1, cy + 1, headTop + 1, SLOT.hair);
  }

  // ---- Facial hair ----
  if (traits.has('beard')) {
    fillBox(voxels, cx - 1, cy - 2, headBottom, cx, cy - 2, headBottom, SLOT.hair);
  }

  // ---- Horns ----
  if (traits.has('horns')) {
    place(voxels, cx - 2, cy, headTop + 1, SLOT.metal);
    place(voxels, cx + 1, cy, headTop + 1, SLOT.metal);
    place(voxels, cx - 2, cy, headTop + 2, SLOT.metal);
    place(voxels, cx + 1, cy, headTop + 2, SLOT.metal);
  }

  // ---- Cape / robe ----
  if (traits.has('cape')) {
    fillBox(voxels, cx - shoulder - 1, cy + 1, torsoBottom, cx + shoulder, cy + 1, torsoTop, SLOT.accent);
    fillBox(voxels, cx - 2, cy + 1, 3, cx + 1, cy + 1, torsoBottom - 1, SLOT.accent);
  }
  if (traits.has('robe')) {
    fillBox(voxels, cx - shoulder - 1, cy - 1, 3, cx + shoulder, cy, torsoBottom - 1, SLOT.accent);
  }
  if (traits.has('tailcoat')) {
    fillBox(voxels, cx - 2, cy + 1, torsoBottom, cx + 1, cy + 1, torsoBottom + 2, SLOT.body);
    fillBox(voxels, cx - 1, cy + 1, 3, cx, cy + 1, torsoBottom - 1, SLOT.body); // tails
  }
  if (traits.has('leather_vest')) {
    fillBox(voxels, cx - shoulder, cy - 1, torsoBottom, cx + shoulder - 1, cy - 1, torsoTop - 1, SLOT.accent);
  }

  // ---- Apron ----
  if (traits.has('apron') || traits.has('apron_white')) {
    const c = traits.has('apron_white') ? SLOT.accent : SLOT.accent;
    fillBox(voxels, cx - 2, cy - 2, torsoBottom, cx + 1, cy - 2, torsoTop - 1, c);
  }

  // ---- Cravat / scarf / sash ----
  if (traits.has('cravat')) {
    fillBox(voxels, cx - 1, cy - 2, neckZ, cx, cy - 2, neckZ, SLOT.accent);
  }
  if (traits.has('red_scarf')) {
    fillBox(voxels, cx - 2, cy - 2, neckZ, cx + 1, cy + 1, neckZ, SLOT.accent);
  }
  if (traits.has('sash_dagger')) {
    fillBox(voxels, cx - 2, cy - 1, torsoBottom + 2, cx + 1, cy - 1, torsoBottom + 3, SLOT.accent);
    place(voxels, cx + 1, cy - 1, torsoBottom + 1, SLOT.metal); // dagger pommel
  }

  // ---- Maid cap ribbon ----
  if (traits.has('maid_cap')) {
    place(voxels, cx - 2, cy, headTop + 1, SLOT.accent);
    place(voxels, cx + 1, cy, headTop + 1, SLOT.accent);
  }

  // ---- White gloves ----
  if (traits.has('white_gloves')) {
    fillBox(voxels, cx - shoulder - 1, cy - 1, torsoBottom, cx - shoulder - 1, cy, torsoBottom + 1, SLOT.accent);
    fillBox(voxels, cx + shoulder,     cy - 1, torsoBottom, cx + shoulder,     cy, torsoBottom + 1, SLOT.accent);
  }

  // ---- Weapons ----
  if (traits.has('sabre_right') || traits.has('sword_right')) {
    fillBox(voxels, cx + shoulder + 1, cy - 1, torsoBottom - 4, cx + shoulder + 1, cy - 1, torsoBottom + 4, SLOT.metal);
    place(voxels, cx + shoulder + 1, cy - 1, torsoBottom + 5, SLOT.wood); // hilt
  }
  if (traits.has('sabre_left')) {
    fillBox(voxels, cx - shoulder - 2, cy - 1, torsoBottom - 4, cx - shoulder - 2, cy - 1, torsoBottom + 4, SLOT.metal);
    place(voxels, cx - shoulder - 2, cy - 1, torsoBottom + 5, SLOT.wood);
  }
  if (traits.has('club_right')) {
    fillBox(voxels, cx + shoulder + 1, cy - 1, torsoBottom - 2, cx + shoulder + 1, cy - 1, torsoBottom + 4, SLOT.wood);
  }
  if (traits.has('staff')) {
    fillBox(voxels, cx + shoulder + 1, cy - 1, 3, cx + shoulder + 1, cy - 1, torsoTop + 3, SLOT.wood);
    place(voxels, cx + shoulder + 1, cy - 1, torsoTop + 4, SLOT.glow);
  }
  if (traits.has('shovel')) {
    fillBox(voxels, cx + shoulder + 1, cy - 1, 3, cx + shoulder + 1, cy - 1, torsoTop + 1, SLOT.wood);
    fillBox(voxels, cx + shoulder + 1, cy - 2, torsoTop + 1, cx + shoulder + 1, cy + 1, torsoTop + 2, SLOT.metal);
  }

  // ---- Wings (crimson angel) ----
  if (traits.has('wings')) {
    fillBox(voxels, cx - shoulder - 2, cy + 1, torsoBottom + 2, cx - shoulder - 1, cy + 1, torsoTop, SLOT.accent);
    fillBox(voxels, cx + shoulder,     cy + 1, torsoBottom + 2, cx + shoulder + 1, cy + 1, torsoTop, SLOT.accent);
  }

  // ---- Tail (sebek_ari, swarm_snakes) ----
  if (traits.has('tail')) {
    for (let i = 0; i < 4; i++) {
      place(voxels, cx - 1 + (i % 2), cy + 1 + Math.floor(i / 2), Math.max(0, torsoBottom - 2 - i), SLOT.body);
    }
  }

  // ---- Wisp tail (air elemental) ----
  if (traits.has('wisp_tail')) {
    for (let z = 0; z < 6; z++) {
      const w = 2 - Math.floor(z / 2);
      fillBox(voxels, cx - w, cy - w, z, cx + w - 1, cy + w - 1, z, SLOT.body);
    }
  }

  // ---- Glow aura ----
  if (traits.has('glow_aura')) {
    place(voxels, cx - shoulder - 1, cy + 1, headBottom, SLOT.glow);
    place(voxels, cx + shoulder,     cy + 1, headBottom, SLOT.glow);
  }

  // ---- Wide mouth (giant toad) ----
  if (traits.has('wide_mouth')) {
    fillBox(voxels, cx - 1, cy - 2, headBottom, cx, cy - 2, headBottom, SLOT.eye);
  }
}

// ---------------------------------------------------------------------------
// MagicaVoxel .vox binary writer (unchanged)
// ---------------------------------------------------------------------------

function rgba(hex, a = 255) {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff, a];
}

function buildPalette(profile) {
  const pal = new Array(256).fill(0).map(() => [0, 0, 0, 0]);
  pal[SLOT.body   - 1] = rgba(profile.bodyColor);
  pal[SLOT.hair   - 1] = rgba(profile.hairColor);
  pal[SLOT.skin   - 1] = rgba(profile.skin);
  pal[SLOT.eye    - 1] = rgba(profile.eye);
  pal[SLOT.boot   - 1] = rgba(0x1a1208);
  pal[SLOT.belt   - 1] = rgba(0x4a3014);
  pal[SLOT.accent - 1] = rgba(profile.accent ?? 0x333333);
  pal[SLOT.metal  - 1] = rgba(0xbbbbbb);
  pal[SLOT.wood   - 1] = rgba(0x6a4422);
  pal[SLOT.glow   - 1] = rgba(profile.eye);
  for (let i = 10; i < 256; i++) pal[i] = [128, 128, 128, 255];
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
  // Clamp voxels to grid + drop dupes (last-write-wins).
  const cells = new Map();
  for (const v of voxels) {
    if (v.x < 0 || v.y < 0 || v.z < 0 || v.x >= size.x || v.y >= size.y || v.z >= size.z) continue;
    cells.set(`${v.x},${v.y},${v.z}`, v);
  }
  const uniqueVoxels = [...cells.values()];

  const sizeBuf = Buffer.alloc(12);
  sizeBuf.writeUInt32LE(size.x, 0);
  sizeBuf.writeUInt32LE(size.y, 4);
  sizeBuf.writeUInt32LE(size.z, 8);
  const sizeChunk = makeChunk('SIZE', sizeBuf);

  const xyziBuf = Buffer.alloc(4 + uniqueVoxels.length * 4);
  xyziBuf.writeUInt32LE(uniqueVoxels.length, 0);
  uniqueVoxels.forEach((v, i) => {
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
  return uniqueVoxels.length;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

fs.mkdirSync(OUT_DIR, { recursive: true });

let count = 0;
for (const profile of CHARACTERS) {
  const { voxels, anchors } = buildBase(profile);
  addAccessories(voxels, anchors, profile);
  const palette = buildPalette(profile);
  const outPath = path.join(OUT_DIR, `${profile.key}.vox`);
  const n = writeVox(outPath, voxels, palette, { x: GRID_X, y: GRID_Y, z: GRID_Z });
  count++;
  console.log(`wrote ${outPath} (${n} unique voxels)`);
}
console.log(`\nDone. ${count} models in ${OUT_DIR}`);
