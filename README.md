# Long Watch

A first-person voxel D&D one-shot adventure. You are hired to protect the Heir of a harbor matriarch until dawn. Tonight, an assassin comes for him.

## What it is

- **Voxel mansion** to defend through the night
- **Random plot** every session: who hired the hit, who the assassin is, what twists you face
- **Secret objectives** per player (multiplayer planned) — be a Pacifist, Traitor, Thief, Smitten, etc.
- **AI-driven NPCs** via Groq Llama 3.3 — speak to the Matriarch, the Heir, the Right Hand, the staff
- **D&D 5e mechanics**: action economy, initiative, conditions, saves, opportunity attacks
- **One night, one shot** — survive till dawn or die trying

Adapted with respect from *The Contract* by Lucas Zellers (Scintilla Studio).

## Quick start

```bash
git clone https://github.com/FaintKom/long-watch.git
cd long-watch
npm install
cp .env.example .env
# put your Groq API key in .env (free at https://console.groq.com/keys)
npm run dev
```

Open `http://localhost:3100`.

## Tech

- **TypeScript** + **Vite** (dev server + AI proxy via middleware)
- **Three.js** (voxel renderer, lighting, shadows)
- **cannon-es** (physics)
- **Groq API** (Llama 3.3 70B for in-character NPC dialogue)
- Multiplayer planned via **Colyseus** (WebSocket authoritative server)

## Status

**Alpha — solo playable.**

Working systems:
- Voxel mansion (18 rooms, 2 floors, courtyard, garden, stairs, windows)
- FPS controller with crouch / sprint / jump
- D&D 5e Lv 4 character with Fighter / Rogue / Wizard / Cleric pick on start screen
- Plot roll system (1d8 Boss / 1d6 Assassin / 1d8 Twist / 1d12 Objective)
- Game clock (event-driven + idle drift, dawn at 5 AM)
- 7 AI-driven cast NPCs (Magrath, Wallace, Right Hand, Cook, Butler, Maid, Gardener) with strict in-character guardrails via Groq Llama 3.3
- Assassin encounters with 6 spawn sets (Mooks, Sea Cult, Crimson Angel, Sebek-Ari, Mezzoloth, Air Elemental)
- LMB melee combat (d20 + 5 vs AC, longsword 1d8+3, crit on 20)
- Combat log + end screen (DAWN payout / banishment for Heir's death)

Planned (skeleton in place):
- Colyseus multiplayer for 3-4 players (`src/state.ts` shape ready)
- Skill checks UI for clues that reveal Boss/Twist
- Full spell system for Wizard / Cleric
- Class signature actions (Second Wind, Sneak Attack, Channel Divinity)
- Save/load (server-authoritative)

## Plot pieces

Each new game rolls:

- **Boss** (1d8) — who paid for the hit: rival merchants, assassin guild, goddess of the sea, a jilted suitor, the Unseelie Court, a sentient sword, the Right Hand, or no one at all
- **Assassin** (1d6) — Mooks, Cult, the Crimson Angel, Sebek-Ari the Yuan-ti, Mezzoloth, or Air Elemental
- **Twist** (1d8) — poisoned heir, fake death, doppelganger matriarch, blue dragon heir...

## License

MIT for code. The original adventure remains (c) Lucas Zellers and is not redistributed. See `LICENSE` for details.
