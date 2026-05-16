# Long Watch — Project State (Context Recovery Notes)

Living doc. Last updated: Iter 31 (rich personas + world feed for AI NPC dialogue).

If context is dropped, read this first, then `docs/DESIGN.md`, then `src/main.ts`.

---

## 1. What this is

First-person voxel D&D one-shot adapted from "The Contract" by Lucas Zellers. One night, one manor, one Heir to keep alive until dawn. Hybrid event-clock + AI-driven NPCs.

Stack: **Vite + TypeScript** dev server, **Three.js** WebGL renderer (InstancedMesh voxels + shadows), **cannon-es** rigid physics, **Groq Llama 3.3 70B** for streaming NPC dialogue via SSE.

Repo: github.com/FaintKom/long-watch
Dev server: `npm run dev` -> http://localhost:3100
Env: `.env` with `GROQ_API_KEY=...` (gitignored). Optional `GROQ_MODEL=`.

---

## 2. File map (src/)

| File | Role |
|------|------|
| `main.ts` | Entry point. Wires renderer, physics, mansion, player, plot, cast, enemies, companion, dialogue, shop, save/load, room-entry, frame loop. ~1370 lines. |
| `world.ts` | VoxelWorld: instanced-mesh voxel grid, fill/get/set. |
| `mansion.ts` | `buildMansion(world, physics, scene)`: 50x12x50 manor, 18 rooms + courtyard + garden + stairs. Exports `MAP_W/MAP_H/MAP_D`, `landmarks`. |
| `physics.ts` | Cannon-es world wrapper. `addDynamicSphere`, `addStaticBox`, step. |
| `player.ts` | First-person controller. Yaw/pitch group, jump, crouch, sneak (stealth bonus). |
| `character.ts` | D&D Lv4 stat block. `rollDice(sides)`, `rollNd(n,sides)`, ability mods, prof bonus. |
| `classes.ts` | 4 base classes (Fighter, Rogue, Cleric, Wizard). `applyClass(character, classId)` mutates stats. |
| `actions.ts` | Class signature actions + spells. ResourcePool (action surge, second wind, sneak, channel div, slots). |
| `clock.ts` | `GameClock`: state.currentMinute, formatted(), advance(eventKey), driftStep(dt). Hybrid event+drift. Triggers warning (-30 min), assassin arrival, dawn. |
| `plot.ts` | Random tables: BOSSES (1d8), ASSASSINS (1d6), TWISTS (1d8), OBJECTIVES (1d12). `rollPlot()`, `rollObjectivesForParty()`. |
| `cast.ts` | 7 named NPCs (Matriarch/Heir/Right Hand/Cook/Butler/Maid/Gardener) with **rich personas** (persona, backstory, positionTonight, motivation, dailyRoutine, relationships, knownFacts, hiddenFacts, speechStyle, voiceSamples). `CastMember` class with AI state machine: idle/fleeing/fighting/alarmed/dead. `applyPlotContext(cast, twists, boss)` mutates personas for twists. |
| `events.ts` | `WorldFeed` chronicle: `add(text, minute, visibility)`, `recentFor(castId, count)`, `formatEventsForPrompt(events)`. NPCs receive a filtered recent slice as context. |
| `enemy.ts` | Combat enemies (assassin parties). `EnemyKind`: mook, fanatic, priest, giant_toad, crimson_angel, sebek_ari, swarm_snakes, mezzoloth, air_elemental. |
| `assassin.ts` | `ASSASSIN_SPAWNS` per AssassinId + `spawnAssassin(id, scene, physics, mansion)`. Entry points: front_door / window_heir / courtyard / mid_house. |
| `faction.ts` | 8 factions (player_party, fletcher_house, fletcher_staff, sea_cult, forewater, crimson_angels, beast, neutral). Attitude matrix -100..+100. `isHostile/isFriendly`. |
| `companion.ts` | Karla, player-aligned NPC. HP 32, AC 16, +5 atk, 1d8+3. Follows player, fights assassins. |
| `inventory.ts` | Items, throwables, shop inventories, ownership zones, ownerForPosition, reputation per NPC. |
| `props.ts` | 15 prop kinds (pots, crates, food, chairs, doors, etc), PICKUPABLE_KINDS, theft via TheftContext + witness check. |
| `clues.ts` | Investigation clue props per Boss/Twist. |
| `state.ts` | Save/load helpers. |
| `voxModels.ts` | MagicaVoxel `.vox` loader with graceful fallback. `tryUpgradeWithVox(key, group, opts)` swaps box body for vox model if `/models/<key>.vox` exists. Cache per key. |
| `fov.ts` | rot-js wrapper: `isVisibleOnFloor` (shadowcast + cone), `pathOnFloor` (A*). |
| `srd.ts` | Loads `/srd/monsters.json` + `/srd/spells.json` from 5e-bits/5e-database. `getMonster(idx)`, `getSpell(idx)`, `firstMeleeAttackFormula`, etc. |
| `nav.ts` | Per-entity `Navigator` (rot-js A*) with replan caching + drift detection. Module-level `setNavWorld(world)` registers the voxel world at boot; `Enemy`/`CastMember`/`Companion` each own a `Navigator` and call `steerToward(my, target, floorY)` for waypoint-aware movement instead of straight-line. |
| `memory.ts` | NPC long-term memory: wraps `WorldFeed` with reflections (Groq-summarised first-person bullets per NPC) + retrieval. `memory.relevantFor(npcId, query, currentMinute, k)` returns mixed top-K events + reflections scored by recency (60min half-life) + lexical Jaccard + importance. `memory.maybeReflect(...)` fires when an NPC has >= 8 unreflected events - hits `/api/npc-reflect`. |
| `names.ts` | `fantastical` wrappers: `commonerName()`, `speciesName(species, gender)`, `tavernName()`, `guildName()`, `commonerParty(n)`. Used by `assassin.ts` for mook/cult leader naming and exposed via `__names` in console. |
| `dungenGen.ts` | `Labyrinthos` wrapper: `generateDungeon({width,height,algorithm})` -> `DungeonGrid {data, spawn, exit, isFloor, isWall}`. `generateCatacombs(seed)` preset for the act-2 escape route. |
| `catacombs.ts` | Extrudes a `DungeonGrid` into a Three.js + cannon-es sub-level positioned at `Y_OFFSET=30` (above mansion roof). InstancedMesh walls, per-cell static colliders, sparse torch lights, exit ring marker. `buildCatacombs(scene, physics, {seed})` returns `{root, spawn, exit, bodies, isOnExit, dispose}`. `main.ts` calls it when the player interacts with the trapdoor prop in the storage room. |
| `consequences.ts` | `ConsequenceStore` flag map keyed by lowercase_snake_case strings. `set/get/has/inc/knownBy/all`. Flags wired at: warning tick, assassin arrival, dawn, first-NPC-attack, boss-proven, catacombs entry/exit, clue-pass/fail. Format via `formatFlagsForPrompt` for the Groq prompt. **Scoped flags** (e.g. `player_attacked_butler`) use a witness CastId[] so only NPCs who saw the event know it. |
| `witnesses.ts` | `computeWitnesses(cast, {pos, world, raycast, range, coneAware, alwaysIncludes})` returns the CastId[] who actually saw an event (3D raycast + cone-of-vision + sound mode). `diffuseRumors({cast, world, raycast, pushEvent, eventsVisibleTo, currentMinute})` runs every 3 real seconds in main: two co-located NPCs share up to 2 unique recent items each direction as "[rumor from <name>] ..." entries. Player-told info also lands as `[told by player] ...` per-NPC events so retrieval picks it up later. |
| `audio.ts` | `tone.js` synthesized SFX. `unlockAudio()` on first click (Web Audio gesture gate); `play(name)` is no-op until unlocked. Catalog: attack_swing, attack_hit, enemy_falls, door_burst, glass_shatter, chime, rumble, dawn_bell, scream, spell_cast. |
| `rng.ts` | `seedrandom` wrapper. `getSeed()`, `setSeed(s)`, `random()`, `randInt(n)`, `roll(sides)`. Default seed: `?seed=...` URL param or timestamp fallback. plot.ts + dungenGen go through `roll(sides)` so a saved seed reproduces the entire night. Seed shown on objective card. |
| `gameState.ts` | `xstate` machine for major phases: `intro -> exploring -> exploring_warned -> combat -> catacombs -> ending_*`. `startGameActor(onTransition)` creates and starts an actor. main.ts sends `START`, `WARNING`, `ASSASSIN_ARRIVED`, `CATACOMBS_ENTER`, `CATACOMBS_EXIT`, `DAWN`. Exposed on `window.__gameState`. |
| `multiplayer.ts` | Trystero P2P (Nostr strategy, no signaling server). Activated via `?room=NAME` URL param. Each peer broadcasts position+yaw at 10Hz, receives others' positions, renders a "ghost" mesh with name sprite per remote peer. `mp.sendChat(text)` mirrors logCombat lines across peers. For deterministic shared plot, all peers should also pass `?seed=`. |

---

## 3. The Plot system

`rollPlot()` returns:
- `boss: BossId` (1d8) - who hired the assassin
- `assassin: AssassinId` (1d6) - who shows up
- `twists: TwistId[]` (1d8 + 50/50 second twist)
- `assassinArrivalMinute`, `dawnMinute`
- `revealed: { boss, assassin }` (flipped as evidence found)

Then `rollObjectivesForParty(N=4)` gives each player a secret objective.
Then `applyPlotContext(CAST, twists, boss)` mutates NPC personas accordingly:
- `heir_is_dragon` / `heir_is_daughter` / `poisoned_heir` / `fake_death` modify Wallace
- `doppelganger_matriarch` replaces Magrath's persona
- `boss === 'right_hand'` sneaks a secret into the Right Hand

---

## 4. Game clock

Hybrid event-driven + idle drift.
- Starts at 9:00 PM (21*60 minutes).
- Events: `ai_chat_turn` (+1m), `enter_room` (+1m), `investigate` (+3m), combat round = clock paused.
- Idle drift: ~2 in-game minutes per real minute (`driftStep(dt)` each frame).
- Triggers: warning at `arrival-30`, assassin spawn at `arrival`, dawn at `dawn`.

---

## 5. AI NPC dialogue pipeline

1. Player presses E near a CastMember -> opens dialogue UI.
2. Type message -> `streamReply(message)` in `main.ts`.
3. Builds payload from `cm.def.persona.*` (all 10 rich fields) + `attitudeContext` (rep gate) + `worldFeed.recentFor(cm.def.id, 8)` + `gameClock.formatted()`.
4. POSTs to `/api/npc-chat` (Vite middleware in `vite.config.ts`).
5. Vite proxy builds system prompt with strict guardrails + persona + backstory + positionTonight + motivation + relationships + knownFacts + hiddenFacts + voiceSamples + recentEvents block.
6. Forwards to Groq Llama 3.3 70B with SSE streaming. Tokens stream back to UI.
7. Both sides keep history (last 10 turns).

**Rep gates:**
- `rep <= -50` OR `isHostile(fletcher_house, player_party)` -> NPC refuses ("Get out of my sight.").
- `rep <= -25` -> COLD attitude context.
- `rep >= 25` -> WARM attitude context.

**World feed:** `logCombat(line)` appends to combat log AND chronicles to `worldFeed` (public, with current `gameClock.state.currentMinute`). For NPC-scoped chronicling (e.g. theft witnessed only by 2 nearby NPCs) call `worldFeed.add(text, minute, ['matriarch','right_hand'])` directly. To skip the feed for cosmetic UI logging, push to `combatLog` manually instead of via `logCombat`.

---

## 6. Combat / faction interactions

- All entities carry `faction: FactionId`.
- `factionRel = defaultRelationships()` matrix. `adjustAttitude(from, to, delta)`.
- Player attacks a fletcher NPC -> on first hit, `attackedByPlayer = true`, NPC reacts per `reactionOnPlayerAttack`: `fight | flee | alarm`. `reputation.alarmed = true`. If too many fletcher NPCs hurt/killed -> `adjustAttitude(fletcher_house, player_party, -100)` -> hostile.
- Hostile fletcher NPCs join `threats` list in main loop; player can be hit by them.
- Witness theft -> -10 rep to surrounding NPCs in 6m radius.

---

## 7. Hotkeys (in-game)

| Key | Action |
|-----|--------|
| WASD | Move |
| Shift | Sneak (stealth+) |
| Ctrl | Crouch |
| Space | Jump |
| Mouse | Look + attack (LMB) |
| RMB | Class signature action (Fighter: action surge, Rogue: sneak ready, etc.) |
| 1-4 | Spells (Wizard/Cleric) |
| Q | Cunning Action (Rogue) / second wind (Fighter) |
| R | Reload spell list |
| F | Throw item (selected from inventory) |
| E | Interact (talk / pick up / investigate clue / open door) |
| T | Trade with nearest shop NPC |
| I | Use selected inventory item |
| Esc | Close dialogue/shop |
| C | Toggle clue inventory / evidence log |
| F5 | Save |
| F9 | Load |

---

## 8. Env / setup

```
F:\long-watch\
  .env                  # GROQ_API_KEY=gsk_...
  vite.config.ts        # /api/npc-chat proxy -> Groq
  package.json
  index.html
  src/                  # game code
  docs/
    DESIGN.md           # full design spec
    STATE.md            # THIS FILE
  server/               # (Colyseus scaffold for multiplayer; optional)
```

```bash
npm install
npm run dev             # http://localhost:3100
```

---

## 9. Iteration log (recent)

- **Iter 19**: Authentic interactable props (15 kinds: pots, crates, chairs, doors, food, weapons, etc).
- **Iter 20**: Ownership system + steal/buy/transfer + witness check.
- **Iter 21**: Throwables via cannon-es dynamic spheres. Removed chair-sit healing.
- **Iter 22-30**: Full faction system, player-attacks-NPC handling, companion (Karla), reputation gates, save/load, mobile controls, Heir AI variants.
- **Iter 31**: Rich AI personas (10 fields per NPC) + WorldFeed event chronicle injected into Groq prompts. All scripted dialogue branches removed - pure AI now.
- **Iter 40** (current): Five outstanding items closed.
  - **Atomic combat frame.** `src/combat.ts` `resolveAttack(att, tgt, opts)` returns a `CombatFrame` (roll/total/damage/postHp/lethal/narrative/sfxCue) WITHOUT mutating anything. `applyCombatFrame(frame, hooks)` is the single mutate-and-narrate step. swingAt refactored. Pattern #3 satisfied: prose + stat-delta + sfx in one transaction.
  - **Save/load v2.** Schema bumped to `long-watch-save-v2`. Persists Memory (events + per-NPC reflections + nextId counters), ConsequenceStore (all flags with knownBy), gameActor phase, RNG seed. Load restores via `setSeed(...)`, replays gameActor START/WARNING/ASSASSIN_ARRIVED/CATACOMBS_ENTER to reach saved phase. v1 saves still loadable.
  - **Catacombs depth.** `Catacombs.pickWavePoints(frac, count)` + `lootSpots`. Three staged ambushes at distance 0.30/0.65/0.90 trigger when player approaches each band. Three loot caches (visible boxes + glint lights) award 25-65 gold + chime sfx on pickup. `tickCatacombsWaves()` + `tickCatacombsLoot()` per frame.
  - **gen-vox v3.** New `CUSTOM_BUILDS` map per character adds distinctive features beyond the trait list: Magrath crossed sabres + longer cape, Mira side panels + skillet, Aldous pocket-watch chain + stand collar, Right Hand satchel + back-dagger, Karla shoulder pad + chest strap, etc. All 7 cast + Karla now flagged `[custom]`. Enemies stay on template.
  - **Code-splitting.** `vite.config.ts` `manualChunks` splits three/cannon/tone/trystero/threejs-vox-loader/rot-js+labyrinthos/xstate/seedrandom/dice-typescript/fantastical into separate bundles. Initial index bundle dropped from 1.3 MB to ~147 KB. Total parallelisable.
- **Iter 39**: Four new libs onboarded.
  - **tone.js -> `src/audio.ts`.** Synthesized SFX (no audio files shipped). Tone unlocks on first click. Triggers at swing/hit/fall/door/rumble/dawn.
  - **seedrandom -> `src/rng.ts`.** `?seed=` URL param yields a deterministic plot + catacombs layout. plot.ts and dungenGen route through `roll(sides)`. Seed displayed on objective card.
  - **xstate -> `src/gameState.ts`.** Top-level FSM (`intro/exploring/exploring_warned/combat/catacombs/ending_*`). main.ts sends transitions at each milestone. Exposed via `window.__gameState`.
  - **Trystero -> `src/multiplayer.ts`.** Opt-in P2P via `?room=NAME`. Nostr strategy = no signaling server. Ghost meshes for remote peers, 10Hz position sync, chat mirroring of logCombat.
  - DivineVoxelEngine / noa / Python libs / Roll20 / Foundry / Unity / Godot remain rejected (stack mismatch / wrong runtime / Babylon-only).
- **Iter 38**: Witness propagation. Bug fix from Iter 37 - off-screen beats and consequence flags were leaking to all NPCs regardless of line-of-sight.
  - `src/witnesses.ts` `computeWitnesses(cast, opts)` filters by 3D voxel raycast, range, optional cone-of-vision. `coneAware:false` for sound events (attacks). Victim always included.
  - `dispatchOffscreenBeat(label, witnessIds?)` accepts a witness list; only those NPCs are sent to `/api/npc-beat`. Default (no list) = all NPCs (for manor-wide events like warning chime / assassin entry).
  - `consequences.set(name, value, minute, knownBy)` now scopes flags by witness set: `player_attacked_<id>` only goes to actual eye/ear witnesses (always plus the victim); `theft_caught_from_<owner>` similar; `entered_catacombs` scoped to NPCs near the trapdoor.
  - `diffuseRumors` runs every 3s in `animate()`. Two co-located NPCs (LOS + 3m) share up to 2 unique recent events each direction, prefixed `[rumor from <name>]`. Excludes already-rumored chains and private off-screen actions.
  - Player-told info: `streamReply` pushes `[told by player] <message>` as an NPC-scoped memory event. Player can now seed info that propagates via rumor diffusion to other NPCs the speaker bumps into.
- **Iter 37**: Three deferred items from Iter 36 follow-up.
  - **Catacombs hostile encounter.** `enterCatacombs()` checks `consequences.has('assassin_arrived')`. If true, spawns 3 mooks (or fanatics for the Sea Cult plot) via `catacombs.pickEnemySpawnPoints(3)` far from spawn. New module-level `catacombsEnemies: Enemy[]` ticked by `tickCatacombsEnemies(dt)` every frame; player melee + LMB also routes to them through a merged enemy pool. Defeating all clears combat and reopens the exit.
  - **Clue inventory UI.** New `#clue-panel` HTML pane (right-top corner) listing every examined clue with PASS/FAIL color + Boss reveal + a recent world-flag tail. `C` toggles. `CluePropInstance` now carries `lastResult`. examineClue stores it + sets a `clue_examined_<id>` flag.
  - **Off-screen NPC beats (Bobby-Gray pattern #5).** New `/api/npc-beat` Vite proxy returns one third-person action sentence per active NPC ("matriarch: She paces the study, blade across her knees."). `dispatchOffscreenBeat(label)` fires at warning, assassin arrival, first-NPC-attack, and catacombs entry. Each returned line is pushed to `memory.addEvent(..., [npcId])` with NPC-scoped visibility so only that NPC remembers its own off-screen move.
- **Iter 36**: Four parallel additions wrapping up `docs/REFERENCE_PROMPTS.md` "next steals".
  - **Catacombs sub-level.** `src/catacombs.ts` extrudes `generateCatacombs(seed)` grid into Three.js + cannon-es geometry at `Y_OFFSET=30`. New `trapdoor` prop kind in `src/props.ts` placed in the storage room. Interacting hides the mansion meshes, teleports the player to catacombs spawn, exit ring marker triggers a new `escaped_catacombs` ending. Per-frame `checkCatacombsExit()` polls.
  - **Consequence flag store.** `src/consequences.ts` `ConsequenceStore` with `set/has/inc/knownBy`. Wired at warning/arrival/dawn/first-attack/boss-proven/catacombs. Flags injected into the Groq npc-chat system prompt as ground-truth world state (pattern #4: consequence > event for clues).
  - **Per-NPC prompt polish.** `streamReply` now sends top-2 personal reflections AND consequence flags separately. Vite proxy lays them out as `=== YOUR LATEST THOUGHTS ===` + `=== WORLD STATE FLAGS YOU KNOW ABOUT ===` blocks. Pattern #1: distilled voice notes per-NPC, not whole roster.
  - **gen-vox v2.** `tools/gen-vox.mjs` rewritten with Minecraft-proportion humanoids (12x6x32) + per-character `traits` (cape, sabres, scarf, apron, tailcoat, gloves, hat, hood, robe, beard, horns, wings, tail, staff, shovel, etc). Each of the 17 entries now has distinct silhouette. All `.vox` files regenerated (240-572 unique voxels each). Vox-upgrade scale adjusted to 0.04 with yOffset -0.05 to fit the taller models.
- **Iter 35**: Tier-3 final cleanup from `docs/INTEGRATIONS.md`.
  - `fantastical` -> `src/names.ts` (commoner/species/tavern/guild). Wired into `spawnAssassin` so the lead Mook gets a procedural name ("Velex steps to the front, blade drawn.") and Cult of Umberlee gets a drow priest name.
  - `Labyrinthos.js` -> `src/dungenGen.ts` with `generateDungeon` + `generateCatacombs` preset. Voxel build deferred; `tools/preview-catacombs.mjs` for ASCII inspection.
  - `Bobby-Gray/claude-dnd-skill` distilled into `docs/REFERENCE_PROMPTS.md` (5 patterns + top-3 next steals). Not imported as a skill.
  - VS Code Homebrewery extensions documented in new `docs/DEV.md`. Not a code dep.
  - Both new libs typed via `src/types/labyrinthos.d.ts`. Generators exposed as lazy imports on `window.__dungen` / `window.__names` so cold-start stays lean.
- **Iter 34**: Two parallel additions.
  - **ai-town memory architecture.** New `src/memory.ts` `Memory` class layers reflections + retrieval over `WorldFeed`. Each NPC accumulates an unreflected-event counter; on threshold (default 8) `maybeReflect` POSTs to the new `/api/npc-reflect` Groq endpoint and stores 1-3 first-person summary bullets. `streamReply` now calls `memory.relevantFor(npcId, message, currentMinute, 8)` (recency 0.55 + Jaccard 0.35 + importance 0.10 for events; reflections weighted higher on similarity + importance). Bilingual tokenizer (Latin + Cyrillic). No embedding API dep.
  - **Procedural .vox models.** New `tools/gen-vox.mjs` writes a 10x6x20 voxel humanoid per character using their `bodyColor`/`hairColor`/`skin`/`eye` palette. 17 files generated into `public/models/` (7 cast + Karla + 9 enemies). `threejs-vox-loader` now finds an asset for every NPC; box meshes upgrade to colored figures at runtime. Replace any model with a hand-modeled .vox anytime - loader doesn't care.
- **Iter 33**: Tier-2 A* pathfinding. New `src/nav.ts` with rot-js A*, per-entity `Navigator` cache (replan on target-move, staleness, or drift). Wired into `Enemy.updateAi` (assassin approach), `CastMember.updateAi` (fleeing toward anchor + fighting toward threat), `Companion.update` (toward enemy + follow player). NPCs now walk around walls and furniture instead of into them. `setNavWorld(world)` called once from `main.ts` after `buildMansion`.
- **Iter 32**: Tier-1 third-party integrations from `docs/INTEGRATIONS.md`:
  - `dice-typescript` -> `rollFormula`, `rollAttackDamage` in `character.ts`; deleted 5 regex parsers in `enemy.ts` / `companion.ts` / `actions.ts` / `character.ts` / `main.ts`.
  - `threejs-vox-loader` + `src/voxModels.ts` (graceful fallback). CastMember / Companion / Enemy constructors fire-and-forget upgrade their box body to `/models/<key>.vox` if present. Drop .vox files into `public/models/` to populate.
  - `rot-js` + `src/fov.ts` exposes `isVisibleOnFloor` (PreciseShadowcasting + cone-of-vision gate) and `pathOnFloor` (A* on Y-slice). `witnessCheck` now uses both raycast LOS and shadowcast + 100deg cone — NPC facing away can't witness theft.
  - `5e-bits/5e-database` shallow-cloned into `vendor/5e-database` (gitignored). Needed JSON files copied into `public/srd/{monsters,spells}.json`. `src/srd.ts` loads + indexes them. `enrichPresetsFromSRD()` runs at boot to override `ENEMY_PRESETS` HP/AC/attackBonus/damageDice from canonical statblocks for `thug`/`cultist`/`priest`/`cult-fanatic`/`giant-toad`/`swarm-of-poisonous-snakes`/`air-elemental`. Custom bosses keep hand-tuned stats.

---

## 10. Next likely tasks

- Add more granular event feed scoping (private-witness theft events to nearby NPCs only).
- Per-NPC long-term memory: persist `cm.history` across saves.
- Auto-summarize history every N turns to keep prompt size bounded.
- Allow NPC-to-NPC overheard dialogue (if a CastMember is within X of another's conversation).
- Inject plot reveals into the feed when player finds clues (e.g. "Magrath: the player produced Forewater's signet ring").
