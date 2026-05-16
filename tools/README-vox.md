# Voxel character generation

Four ways to produce `.vox` files in `public/models/`. They are loaded at runtime by `src/voxModels.ts` and replace the box-mesh fallback in `cast.ts` / `enemy.ts` / `companion.ts`.

## 1. Procedural (default, free, no network)

```bash
node tools/gen-vox.mjs
```

Writes 17 hand-coded humanoid silhouettes with per-character distinguishing
features (Magrath's crossed sabres, Mira's iron skillet, etc).

## 2. AI-generated (Replicate text2vox, paid ~$0.01-0.05 per character)

```bash
REPLICATE_API_TOKEN=r8_xxx node tools/gen-vox-ai.mjs
```

Uses `gfodor/text2vox` on Replicate. Sign up at https://replicate.com.
Override prompts per character on the command line:

```bash
REPLICATE_API_TOKEN=$TOK node tools/gen-vox-ai.mjs \
  magrath="elegant matriarch in crimson silks with twin sabres, voxel art" \
  wallace="thin nervous noble boy in blue silks, voxel art"
```

Flags:
- `--dry` — print prompts without calling Replicate.
- `--keep-template` — write `public/models/<key>.ai.vox` instead of overwriting.

If a generation fails, the existing procedural file stays in place.

## 3. Kenney CC0 pack (free, manual)

Download https://www.kenney.nl/assets/voxel-pack — 190 CC0 `.vox` assets.
Drop renamed files into `public/models/`:

```
public/models/magrath.vox
public/models/wallace.vox
```

## 4. Hand-modeled in MagicaVoxel

Open any `.vox` in MagicaVoxel, edit, save back. Loader doesn't care which
tool produced them.

## Cleanup / reset

```bash
node tools/gen-vox.mjs   # regenerate ALL procedural stubs
```
