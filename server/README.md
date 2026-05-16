# Long Watch — Multiplayer Server (Planned)

This folder will hold the Colyseus authoritative server for 3-4 player co-op.

## Architecture

```
[Browser x N]  <-- WS -->  [Colyseus Room]  on Fly.io / Render / localhost
                                  |
                          Authoritative GameState (src/state.ts)
                                  |
                          Per-player view (objectives hidden,
                          plot revealed-flag gated)
```

## Responsibilities

- Roll plot once per room. Assign secret objectives 1-per-player.
- Owns the clock. Broadcasts tick on action / drift.
- Routes NPC chat via `/api/npc-chat` proxy (same Vite middleware logic).
- Authoritative: all player actions go through the room schema methods.
- Hidden info: each client only sees their own objective. Boss/twist appear in
  every client's view ONLY after `plot.revealed.*` flips.

## Implementation skeleton (to be filled)

```ts
import { Room, Client } from 'colyseus';

class LongWatchRoom extends Room {
  maxClients = 4;

  onCreate() {
    // initialize this.state from src/state.ts
    // roll plot, set clock, prepare cast
  }

  onJoin(client: Client, options: any) {
    // create PlayerState, assign unused objective
  }

  onMessage("move", (client, msg) => {/* update position */});
  onMessage("attack", (client, msg) => {/* roll d20, resolve */});
  onMessage("chat_npc", (client, msg) => {/* call /api/npc-chat */});
  onMessage("reveal_clue", (client, msg) => {/* set plot.revealed.boss = true */});

  onLeave(client) {/* mark inactive, keep state */}
}
```

## TODO

- `package.json` for server with colyseus + ws deps
- Schema decorators mirroring `src/state.ts`
- Action dispatcher (single function in `main.ts` already routes through here)
- Deploy script (Fly.io or Render free tier)
- Lobby UI in `index.html` (host code, join code)
- LAN testing instructions

For now, the game runs solo in `src/main.ts` with local state. The shape of
`GameState` in `src/state.ts` is already multiplayer-ready.
