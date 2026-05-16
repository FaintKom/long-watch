# Long Watch

A first-person voxel D&D one-shot. You are hired to protect the Heir of a harbor matriarch until dawn. Tonight, an assassin comes for him.

Adapted with respect from *The Contract* by Lucas Zellers (Scintilla Studio).

## Features

- **Voxel mansion** with 18 rooms across 2 floors, courtyard, garden, plus an act-2 catacombs sub-level reached through a hidden trapdoor.
- **Random plot every run** rolled from D&D-style tables: who hired the hit (1d8 Boss), who shows up (1d6 Assassin), what twist is in play (1d8), and a secret per-player objective (1d12). Same `?seed=` reproduces the same night.
- **Pure-LLM AI NPCs** via Groq Llama 3.3 70B. Each of the 7 named cast members has a 10-field rich persona (backstory, position-tonight, motivation, daily routine, relationships, knownFacts, hiddenFacts, speechStyle, voiceSamples) and a long-term memory with reflections + consolidation.
- **Witness propagation**: NPCs only learn what they actually saw, heard, were told, or heard via rumor diffusion from a co-located witness.
- **D&D 5e Lv 4** mechanics: Fighter / Rogue / Wizard / Cleric, 22 spells, action economy, initiative, atomic combat resolver (`resolveAttack` → `CombatFrame` → apply step), critical/fumble handling, sneak attack.
- **Faction system** with 8 factions, attitude matrix, alarm cascades.
- **Procedural .vox NPC models** (or hand-modeled, or AI-generated via Replicate text2vox — see `tools/README-vox.md`).
- **Multiplayer (opt-in)** P2P via Trystero/Nostr. `?room=NAME` joins, ghost meshes for peers, chat overlay (Y), state sync for kills + clue exams.
- **Synthesized audio** via tone.js — no audio files shipped. Ambient loops per location + SFX on combat / arrivals / dawn.
- **Save/load** with 5 slots + base64 export/import + auto-save on milestones.

## Quick start

```bash
git clone https://github.com/FaintKom/long-watch.git
cd long-watch
npm install
cp .env.example .env
# put your Groq API key in .env (free tier at https://console.groq.com/keys)
npm run dev
```

Open `http://localhost:3100`.

### Optional seeds + rooms

```
http://localhost:3100/?seed=lw-saturday        # reproducible plot
http://localhost:3100/?room=my-game            # P2P with anyone using the same room name
http://localhost:3100/?seed=lw-1&room=my-game  # multiplayer shared plot
```

## Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Mouse | Look + LMB attack |
| Shift | Sneak (stealth+) |
| Ctrl | Crouch |
| Space | Jump |
| RMB | Class signature action |
| 1-4 | Spells (caster) |
| Q | Cunning Action / Second Wind |
| F | Throw selected item |
| E | Interact (talk / pick up / examine clue / open) |
| T | Trade with nearest shop NPC |
| I | Use selected inventory item |
| C | Toggle clue/evidence log |
| Y | Open party chat (multiplayer) |
| F5 / F9 | Save / Load |
| Esc | Pause menu (Resume / Save / Load / Export / Import / Quit) |

## Project status

40+ iterations in, polish phase. See [`docs/STATE.md`](docs/STATE.md) for the full file map + iteration log. Test suite: `npm test` (39+ unit tests).

## Documentation

- [`docs/STATE.md`](docs/STATE.md) — file-by-file map + iteration log (read first on session resume)
- [`docs/DESIGN.md`](docs/DESIGN.md) — full design spec
- [`docs/DEV.md`](docs/DEV.md) — local dev setup, env, troubleshooting
- [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) — third-party libraries used + tier picks
- [`docs/REFERENCE_PROMPTS.md`](docs/REFERENCE_PROMPTS.md) — prompt-design patterns from claude-dnd-skill (study, not import)
- [`docs/API.md`](docs/API.md) — internal Groq proxy endpoints (`/api/npc-chat`, `/api/npc-reflect`, `/api/npc-beat`, `/api/npc-talk`)
- [`tools/README-vox.md`](tools/README-vox.md) — voxel character pipeline (procedural / AI / Kenney / MagicaVoxel)

## Tech

- Vite 6 + TypeScript 5 (strict)
- Three.js 0.177, cannon-es
- Groq Llama 3.3 70B via Vite middleware proxy (no API key in browser bundle)
- xstate 5 for game phase FSM
- rot-js for FOV + A*, Labyrinthos for catacombs, fantastical for names
- dice-typescript for formulas, seedrandom for determinism
- tone.js for synthesized audio (lazy-loaded)
- Trystero (Nostr strategy) for P2P multiplayer
- Vitest for tests

## License

MIT for code. The original adventure remains (c) Lucas Zellers and is not redistributed. See `LICENSE` for details.
