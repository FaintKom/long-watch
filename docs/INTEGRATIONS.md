# Long Watch - Third-Party Integrations Plan

Catalog of GitHub libs/skills relevant to this project + picks for direct integration. Drop-in replacements over hand-rolled code.

---

## Full catalog (by category)

### 1. D&D 5e rules / SRD

| Repo | Stars | Active | Use |
|------|-------|--------|-----|
| [5e-bits/5e-database](https://github.com/5e-bits/5e-database) | ~600 | Yes | Full SRD JSON (monsters, spells, classes, equipment). |
| [5e-bits/5e-srd-api](https://github.com/5e-bits/5e-srd-api) | - | Yes | REST/GraphQL over the JSON. |
| [tom-wolfe/dice-typescript](https://github.com/tom-wolfe/dice-typescript) | ~140 | Yes | Parses `2d6+3`, advantage, exploding dice. TS-native. |
| [risadams/dice-roller](https://github.com/risadams/dice-roller) | - | Yes | Alternative TS dice lib. |

### 2. JS/TS RPG game-dev

| Repo | Stars | Active | Use |
|------|-------|--------|-----|
| [ondras/rot.js](https://github.com/ondras/rot.js) | ~3.5k | Yes | Roguelike toolkit: dungeon-gen, FOV, A*/Dijkstra, scheduler. |
| [qiao/PathFinding.js](https://github.com/qiao/PathFinding.js) | ~12k | Mature | A*, JPS on grids. |
| [hylyh/bondage.js](https://github.com/hylyh/bondage.js) | - | Yes | Yarn dialogue parser. |
| [yantra-core/Labyrinthos.js](https://github.com/yantra-core/Labyrinthos.js) | ~300 | Yes | Proc-gen 2D/3D voxel dungeons. |

### 3. Three.js voxel / FPS

| Repo | Stars | Active | Use |
|------|-------|--------|-----|
| [Divine-Star-Software/DivineVoxelEngine](https://github.com/Divine-Star-Software/DivineVoxelEngine) | ~1k | Yes | Multi-threaded TS voxel engine, Three.js backend. |
| [Coding-Kiwi/threejs-vox-loader](https://github.com/Coding-Kiwi/threejs-vox-loader) | - | Yes | MagicaVoxel `.vox` loader with PBR + emissive lights. |
| [matthewjosephtaylor/magica-voxels](https://github.com/matthewjosephtaylor/magica-voxels) | - | Yes | Pure TS .vox parser. |
| [fenomas/noa](https://github.com/fenomas/noa) | - | Mature | Voxel engine - Babylon-only, skip. |

### 4. AI NPC / LLM dialogue

| Repo | Stars | Active | Use |
|------|-------|--------|-----|
| [a16z-infra/ai-town](https://github.com/a16z-infra/ai-town) | ~8k | Yes | TS multi-NPC sim with memory, planning, embeddings. Groq-compat via base URL. |
| [AkshitIreddy/Interactive-LLM-Powered-NPCs](https://github.com/AkshitIreddy/Interactive-LLM-Powered-NPCs) | - | Yes | Vector-store NPC memory + personality cards (Python). |
| [VoltAgent/voltagent](https://github.com/VoltAgent/voltagent) | - | Yes | TS agent framework, durable memory adapters, Groq support. |

### 5. Claude Code skills for TTRPG

| Repo | Use |
|------|-----|
| [Bobby-Gray/claude-dnd-skill](https://github.com/Bobby-Gray/claude-dnd-skill) | Full 5e DM skill, persistent campaigns. |
| [PinchOfData/claude-dungeon-master](https://github.com/PinchOfData/claude-dungeon-master) | Solo 5e DM, markdown state. |
| [Sstobo/Claude-Code-Game-Master](https://github.com/Sstobo/Claude-Code-Game-Master) | RAG over rulebooks; system-agnostic. |
| [nicmarti/skills-weaver](https://github.com/nicmarti/skills-weaver) | TTRPG engine on Claude Agent SDK. |

### 6. VS Code TTRPG writing

| Ext | Use |
|-----|-----|
| [nathonius/homebrewery-vscode](https://github.com/nathonius/homebrewery-vscode) | Homebrewery preview + statblock snippets. |
| [Dungeons & Markdown](https://marketplace.visualstudio.com/items?itemName=SpjakSoftware.dungeonsandmarkdown) | Homebrewery V3, `dnm-` snippets. |
| [brewdown-vscode](https://marketplace.visualstudio.com/items?itemName=officerhalf.brewdown-vscode) | Lightweight 5e markdown. |

### 7. Asset / name / dungeon generators

| Repo | Use |
|------|-----|
| [skeeto/fantasyname](https://github.com/skeeto/fantasyname) | Fantasy name gen, pattern syntax. |
| [seiyria/fantastical](https://github.com/seiyria/fantastical) | Race-aware names (npm). |
| [ReDDarKwh/js.fantasy-names](https://github.com/ReDDarKwh/js.fantasy-names) | Names + place/dungeon descriptions. |
| [Gregory-Jagermeister/Fantasy-Content-Generator](https://github.com/Gregory-Jagermeister/Fantasy-Content-Generator) | Dungeon descriptor generator. |

---

## Picks for direct integration (replace current code)

Ranked by ROI: drop-in replacements that delete or improve hand-rolled code in this repo.

### TIER 1 - install + integrate now

#### 1. `dice-typescript` -> replace `rollDice` / `rollNd` in `src/character.ts`
- **Current**: hand-rolled `rollDice(sides)` and a regex parser `m.match(/(\d+)d(\d+)(?:\+(\d+))?/)` scattered in `companion.ts`, `cast.ts`, `main.ts`.
- **After**: one import. Supports `2d6+3`, `1d20kh1` (advantage = keep highest), `4d6dl1` (drop lowest), exploding `1d6!`, etc.
- **Files changed**: `character.ts` (export new helpers), `companion.ts:109` (the regex), `cast.ts` damageDice eval, every `roll === 20 ? n*2 : n` crit-double in main.ts.
- **Risk**: low. ~50 LOC deleted.

```bash
npm i dice-typescript
```

#### 2. `5e-bits/5e-database` -> replace hardcoded monsters in `src/enemy.ts` + spells in `src/actions.ts`
- **Current**: `EnemyKind` switch with hand-typed `mook`, `priest`, `mezzoloth` statblocks. `SPELLS` constant in actions.ts.
- **After**: drop SRD JSON into `public/srd/`, lazy-fetch on demand, map SRD ids to game enemies. Keep current names but pull HP/AC/attacks from SRD.
- **Files changed**: new `src/srd.ts` loader, `enemy.ts` reads from it, `actions.ts` SPELLS imports from SRD.
- **Risk**: medium - current statblocks were tuned for a Lv4 party; SRD CR values may need scale tweaks. Keep the JSON as canonical source, layer custom modifiers on top.

```bash
# clone JSON only, gitignore the rest
git submodule add https://github.com/5e-bits/5e-database vendor/5e-database
```

#### 3. `a16z-infra/ai-town` memory architecture -> upgrade WorldFeed in `src/events.ts`
- **Current**: linear `events: WorldEvent[]`, last-N filter.
- **After**: lift their three-tier memory:
  - (a) raw events (already have).
  - (b) reflections - every N turns ask Groq "what important about recent events", store summary.
  - (c) embedding-based recall - store embeddings, retrieve top-K by similarity to current player message.
- **Files changed**: `events.ts` grows `Memory` class, `streamReply` calls `memory.relevantFor(message, npcId)` instead of last-8.
- **Risk**: medium-high. Embedding adds a dependency (e.g. transformers.js for local) or another Groq endpoint.
- **Action**: copy `agent.ts` and `memory.ts` patterns from ai-town, adapt to TS Vite setup.

#### 4. `Coding-Kiwi/threejs-vox-loader` -> replace box-mesh meshes in `cast.ts`, `enemy.ts`, `companion.ts`
- **Current**: every NPC/enemy/companion is `BoxGeometry` torso + head + hair. Looks blocky in the worst way.
- **After**: load `.vox` models from `public/models/{magrath,wallace,mook,...}.vox`. Big visual jump.
- **Files changed**: extract NPC mesh-construction into `src/voxModels.ts`, each `*.ts` calls `loadVox(path)` once at boot.
- **Risk**: low. Falls back to box if model missing.
- **Asset cost**: must model in MagicaVoxel (free).

```bash
npm i threejs-vox-loader
```

### TIER 2 - install + integrate after Tier 1

#### 5. `rot.js` FOV -> replace radius-only witness check in `src/main.ts` (witnessCheck)
- **Current**: `witnessCheck` uses raw 6m radius. NPC behind a wall still "sees" theft.
- **After**: `rot.js` PreciseShadowcasting or RecursiveShadowcasting on the voxel grid Y-slice. NPC must have line-of-sight.
- **Files changed**: `main.ts` witnessCheck rewrites, helper `src/fov.ts` wrapping rot.js with the voxel `world.get(x,y,z)` callback.
- **Risk**: low. Tiny lib.

```bash
npm i rot-js
```

#### 6. `PathFinding.js` or `rot.js` A* -> replace "straight-line velocity toward target" in `cast.ts`, `enemy.ts`, `companion.ts`
- **Current**: `velocity = (dx/dist) * speed` - NPC walks straight into walls.
- **After**: A* on the floor grid, follow waypoints.
- **Files changed**: new `src/nav.ts` builds nav-grid from mansion at startup, `updateAi` paths instead of straight-line.
- **Risk**: medium. Voxel grid -> 2D grid projection per floor is needed.

#### 7. `bondage.js` (Yarn) -> optional hybrid dialogue for set-piece moments
- **Current**: pure LLM dialogue.
- **After**: scripted Yarn nodes for plot-critical lines (Magrath's briefing, "you have proved the boss"), LLM for everything else.
- **Risk**: medium. Adds complexity. Maybe skip - user wants pure LLM direction.

### TIER 3 - nice to have, low ROI now

| Lib | Why later |
|-----|-----------|
| `Labyrinthos.js` | Mansion is hand-built. Use for a future random-dungeon variant. |
| `DivineVoxelEngine` | Overkill - single mansion, no chunked terrain. Would replace `world.ts` entirely. |
| `fantasyname` / `fantastical` | Cast NPCs already named. Use if random commoners added. |
| `Bobby-Gray/claude-dnd-skill` | Reference for prompt design, not direct integration. Read, don't copy. |
| VS Code Homebrewery extensions | For writing `docs/DESIGN.md` and statblocks. Editor tooling, not in-game. |

---

## Concrete next-iteration plan (Iter 32)

1. `npm i dice-typescript` - replace `rollDice`/`rollNd` everywhere. Delete the regex parsers in `companion.ts:109` and Magrath/Wallace damageDice handling.
2. `npm i threejs-vox-loader` - make `src/voxModels.ts`, model 1-2 NPCs in MagicaVoxel as proof. Fall back to box if file missing.
3. `npm i rot-js` - wrap as `src/fov.ts`, swap `witnessCheck` to LOS-aware.
4. Vendor `5e-bits/5e-database` as a submodule, create `src/srd.ts` loader, gradually migrate `enemy.ts` statblocks.
5. Defer ai-town memory until after the SRD work (bigger surface).

Result after Iter 32: ~150 LOC deleted, witness check honest, NPCs not box-people, monster stats canon-correct.

---

## Skip list (researched, rejected)

- `noa` voxel engine - Babylon.js only.
- `DivineVoxelEngine` - overkill for one mansion.
- `Interactive-LLM-Powered-NPCs` - Python, prompts portable but no direct drop-in.
- `VoltAgent` - useful framework but reinventing what dialogue layer already does.
- Roll20 / Foundry plugins - not portable to web standalone.
- Unity / Godot D&D kits - wrong stack.
