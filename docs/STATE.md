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
- **Iter 33** (current): Tier-2 A* pathfinding. New `src/nav.ts` with rot-js A*, per-entity `Navigator` cache (replan on target-move, staleness, or drift). Wired into `Enemy.updateAi` (assassin approach), `CastMember.updateAi` (fleeing toward anchor + fighting toward threat), `Companion.update` (toward enemy + follow player). NPCs now walk around walls and furniture instead of into them. `setNavWorld(world)` called once from `main.ts` after `buildMansion`.
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
