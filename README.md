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

Pre-alpha. Engine systems being assembled from the voxel-rpg base. Mansion level under construction.

## Plot pieces

Each new game rolls:

- **Boss** (1d8) — who paid for the hit: rival merchants, assassin guild, goddess of the sea, a jilted suitor, the Unseelie Court, a sentient sword, the Right Hand, or no one at all
- **Assassin** (1d6) — Mooks, Cult, the Crimson Angel, Sebek-Ari the Yuan-ti, Mezzoloth, or Air Elemental
- **Twist** (1d8) — poisoned heir, fake death, doppelganger matriarch, blue dragon heir...

## License

MIT for code. The original adventure remains (c) Lucas Zellers and is not redistributed. See `LICENSE` for details.
