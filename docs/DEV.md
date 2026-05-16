# Long Watch - Developer Setup Notes

Quick reference for working on this repo locally.

## Stack

- Vite 6 + TypeScript 5 (strict)
- Three.js 0.177 (WebGL2, InstancedMesh voxels, shadows)
- cannon-es (rigid-body physics)
- Groq Llama 3.3 70B (NPC dialogue + reflections via Vite middleware proxies)

## Required env

`.env` in repo root (gitignored):

```
GROQ_API_KEY=gsk_...
# optional override; defaults to llama-3.3-70b-versatile
# GROQ_MODEL=llama-3.1-70b-versatile
```

## Commands

```bash
npm install
npm run dev                  # dev server on :3100
npx tsc --noEmit             # type check
npx vite build               # production build to dist/
node tools/gen-vox.mjs       # regenerate .vox NPC models into public/models/
node tools/preview-catacombs.mjs                          # default 30x20 RecursiveDivision
node tools/preview-catacombs.mjs RecursiveBacktrack 41 17 # alternate algo + size
```

## Recommended editor tooling (TTRPG writing)

The `docs/DESIGN.md` file is plain markdown but a few VS Code extensions help with statblock formatting and Homebrewery-style preview if you're authoring more 5e content:

- [Homebrewery for VS Code](https://github.com/nathonius/homebrewery-vscode) - Homebrewery V3 preview + `brewStatBlock` snippets.
- [Dungeons & Markdown](https://marketplace.visualstudio.com/items?itemName=SpjakSoftware.dungeonsandmarkdown) - alternate Homebrewery flavor with `dnm-` prefixed snippets.
- [Brewdown for VS Code](https://marketplace.visualstudio.com/items?itemName=officerhalf.brewdown-vscode) - lightweight 5e markdown.

None of these are required to run the game; install only if you're rewriting design docs.

## Repo layout

```
F:\long-watch\
  .env                  # Groq key, gitignored
  vite.config.ts        # /api/npc-chat + /api/npc-reflect proxies
  package.json
  index.html
  src/                  # game code (see docs/STATE.md for file map)
  public/
    models/             # .vox NPC models (regen via tools/gen-vox.mjs)
    srd/                # 5e SRD JSON (monsters.json, spells.json)
  vendor/               # gitignored shallow clones (5e-database)
  tools/                # one-shot devtools (gen-vox, preview-catacombs)
  docs/
    DESIGN.md           # full design spec
    STATE.md            # context-recovery notes - read first on session resume
    INTEGRATIONS.md     # third-party libs catalog + tier picks
    REFERENCE_PROMPTS.md # prompt-design patterns from claude-dnd-skill
    DEV.md              # THIS FILE
```

## Where to look first when something breaks

| Symptom | First file to check |
|---------|---------------------|
| NPC won't respond / 500 from chat | `vite.config.ts` proxy, `.env` GROQ_API_KEY |
| NPC has no character voice | `src/cast.ts` persona block + `vite.config.ts` system prompt assembly |
| NPCs walk into walls | `src/nav.ts` Navigator + `setNavWorld(world)` call in `main.ts` |
| Witness check too eager | `src/main.ts` witnessCheck + `src/fov.ts` cone radius (`Math.PI * 0.55`) |
| Box-mesh NPCs instead of voxel models | `public/models/<key>.vox` exists? `src/voxModels.ts` console errors? |
| SRD enemies have wrong stats | `src/srd.ts` + `ENEMY_SRD_INDEX` mapping in `enemy.ts` |
| Reflections never fire | `Memory.reflectionThreshold` (default 8) in `src/memory.ts`; check `/api/npc-reflect` 200s in Network |
