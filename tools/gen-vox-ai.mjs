#!/usr/bin/env node
/**
 * AI-driven .vox generator via Replicate text2vox (gfodor/text2vox).
 *
 * Usage:
 *   REPLICATE_API_TOKEN=r8_xxx node tools/gen-vox-ai.mjs [key=prompt] [...]
 *
 * Examples:
 *   REPLICATE_API_TOKEN=$TOK node tools/gen-vox-ai.mjs \
 *     magrath="elegant sword-bearing matriarch in crimson robes, voxel art, MagicaVoxel" \
 *     wallace="thin nervous teenage boy in noble blue silks, voxel art, MagicaVoxel"
 *
 * Writes results to public/models/<key>.vox, overwriting the procedural stubs.
 * If a generation fails (404, throttling, content filter), the procedural
 * version stays in place. After running, refresh the browser to pick up the
 * new model files (Vite serves /models/<key>.vox from public/).
 *
 * Optional flags:
 *   --dry           print prompts only; no network calls
 *   --keep-template do NOT overwrite; write to public/models/<key>.ai.vox instead
 *
 * Requires: REPLICATE_API_TOKEN env var. Sign up at replicate.com.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'models');

const DEFAULT_PROMPTS = {
  magrath:       'elegant lithe matriarch in crimson robes with twin sabres, dark braided hair, voxel art, MagicaVoxel, full body, isolated',
  wallace:       'thin nervous teenage noble boy in blue silk doublet, pale hair, voxel art, MagicaVoxel, full body, isolated',
  right_hand:    'broad-shouldered enforcer in brown leather with red scarf and salt-and-pepper beard, voxel art, MagicaVoxel, full body, isolated',
  mira:          'heavyset middle-aged cook in green dress with white apron and rolling pin, voxel art, MagicaVoxel, full body, isolated',
  aldous:        'tall thin elderly butler in black tailcoat with bald head and pocket watch, voxel art, MagicaVoxel, full body, isolated',
  penny:         'young freckled maid in blue dress with white apron and copper-red bun hair, voxel art, MagicaVoxel, full body, isolated',
  old_tom:       'wiry old gardener in moss-green clothes with wide-brimmed hat, gray beard, holding a shovel, voxel art, MagicaVoxel, full body, isolated',
  karla:         'broad warrior woman in studded leather vest with sword on right hip, sandy hair, voxel art, MagicaVoxel, full body, isolated',
  mook:          'hooded thug in dark green tunic with wooden club, glowing red eyes, voxel art, MagicaVoxel, full body, isolated',
  fanatic:       'thin robed cult fanatic in brown rags with glowing orange eyes, voxel art, MagicaVoxel, full body, isolated',
  priest:        'sea cult priest in dark blue robes with staff and glowing blue eyes, voxel art, MagicaVoxel, full body, isolated',
  crimson_angel: 'red-winged crimson angel assassin in dark armor with single sabre, voxel art, MagicaVoxel, full body, isolated',
  sebek_ari:     'serpent-tailed cult assassin in moss-green robes with staff and yellow eyes, voxel art, MagicaVoxel, full body, isolated',
  mezzoloth:     'four-armed insectoid yugoloth with horns and twin sabres, brown chitin, voxel art, MagicaVoxel, full body, isolated',
  air_elemental: 'spectral pale-blue air elemental wisp humanoid, glowing white eyes, voxel art, MagicaVoxel, full body, isolated',
  giant_toad:    'squat giant toad creature, green warty skin, glowing yellow eyes, voxel art, MagicaVoxel, isolated',
  swarm_snakes:  'writhing pile of brown poisonous snakes, glowing yellow eyes, voxel art, MagicaVoxel, isolated',
};

const args = process.argv.slice(2);
const dryRun = args.includes('--dry');
const keepTemplate = args.includes('--keep-template');
const positional = args.filter((a) => !a.startsWith('--'));

const queue = [];
if (positional.length === 0) {
  for (const [key, prompt] of Object.entries(DEFAULT_PROMPTS)) queue.push({ key, prompt });
} else {
  for (const a of positional) {
    const idx = a.indexOf('=');
    if (idx <= 0) {
      console.error(`bad arg: ${a} (expected key=prompt)`);
      process.exit(2);
    }
    const key = a.slice(0, idx).trim();
    const prompt = a.slice(idx + 1).trim();
    queue.push({ key, prompt });
  }
}

if (dryRun) {
  for (const { key, prompt } of queue) console.log(`[dry] ${key}: ${prompt}`);
  process.exit(0);
}

const token = process.env.REPLICATE_API_TOKEN;
if (!token) {
  console.error('Missing REPLICATE_API_TOKEN env var.');
  console.error('Sign up at https://replicate.com and set REPLICATE_API_TOKEN=r8_xxx');
  process.exit(1);
}

const { default: Replicate } = await import('replicate');
const client = new Replicate({ auth: token });

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const { key, prompt } of queue) {
  console.log(`[gen-vox-ai] ${key}: "${prompt}"`);
  try {
    const output = await client.run('gfodor/text2vox', { input: { prompt } });
    const url = Array.isArray(output) ? output[0] : output;
    if (!url || typeof url !== 'string') {
      console.warn(`  -> no URL returned, skipping`);
      continue;
    }
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  -> fetch failed: ${res.status}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const outName = keepTemplate ? `${key}.ai.vox` : `${key}.vox`;
    const outPath = path.join(OUT_DIR, outName);
    fs.writeFileSync(outPath, buf);
    console.log(`  -> wrote ${outPath} (${buf.length} bytes)`);
  } catch (err) {
    console.warn(`  -> error: ${err?.message ?? err}`);
  }
}

console.log(`\nDone. Procedural stubs remain for any character that wasn't replaced.`);
