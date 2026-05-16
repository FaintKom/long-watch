# Internal API reference

All Vite dev-server middleware proxies live in `vite.config.ts`. The browser bundle never sees the Groq API key — all upstream traffic goes through these routes.

## `/api/npc-chat`  (Iter 30+)

Streams an NPC dialogue line back to the player.

**Method:** `POST`. **Response:** `text/event-stream` (SSE).

Request body:
```jsonc
{
  "npcName": "Magrath Fletcher",
  "persona": "Magrath \"Red Sky\" Fletcher, 45...",
  "backstory": "Born an urchin on the harbor docks...",
  "positionTonight": "Tonight you meet the party in the Entry Hall...",
  "motivation": "Keep Wallace alive.",
  "dailyRoutine": "Wakes at dawn. Reviews ledgers in study...",
  "relationships": "- Wallace: your son. You love him with a fierceness...",
  "knownFacts": "- You hired this party of adventurers tonight...",
  "hiddenFacts": "- You do NOT know the exact identity of tonight's assassin...",
  "speechStyle": "Imperious, low-volume, cuts deep...",
  "voiceSamples": "\"What makes you think you can keep my Heir safe?\"\n...",
  "recentEvents": "- ~event~ [9:30 PM] The front door bursts open...",
  "topReflections": "- I knew Forsythe would come. He always was a coward.",
  "worldFlags": "- assassin_arrived\n- household_alarmed",
  "currentTime": "9:32 PM",
  "history": [{ "role": "user", "content": "..." }],
  "message": "What do you know about Forsythe?"
}
```

Each SSE event is `data: {"token":"..."}`. Stream ends with `data: [DONE]`.

The proxy enforces ~11 hard guardrails in the system prompt (no fourth-wall break, no AI/model leak, no impossible knowledge, max 280 chars, etc).

## `/api/npc-reflect`  (Iter 34)

Asks the model to write 1-3 first-person reflection bullets in the NPC's voice from a recent event list. Used by `Memory.maybeReflect` (every 8 unreflected events) and `Memory.maybeConsolidate` (every 15 reflections — overrides persona to "summarise your own thoughts").

**Method:** `POST`. **Response:** JSON.

Request:
```json
{
  "displayName": "Magrath Fletcher",
  "personaSnippet": "Magrath...iron will hidden behind autumn-colored clothes",
  "events": [
    { "minute": 1290, "text": "The front door bursts open." },
    { "minute": 1295, "text": "Aldous cries out from the Entry Hall." }
  ]
}
```

Response:
```json
{
  "reflections": [
    "I should have armed Aldous before tonight.",
    "Forsythe sent these. The crest matches."
  ]
}
```

## `/api/npc-beat`  (Iter 37)

Returns one third-person sentence per witnessing NPC describing what they are doing RIGHT NOW. Fired at milestones (warning, assassin_arrived, player_attacked_X, catacombs_enter).

Request:
```json
{
  "npcs": [
    { "id": "matriarch", "displayName": "Magrath Fletcher", "persona": "...", "positionTonight": "...", "motivation": "..." }
  ],
  "flags": "- household_alarmed\n- player_attacked_butler",
  "currentTime": "9:42 PM",
  "beatLabel": "player_attacked_butler"
}
```

Response:
```json
{
  "actions": [
    { "npcId": "matriarch", "text": "She draws one saber and turns toward the entry hall." }
  ]
}
```

The proxy parses `id: action` lines from the LLM output and validates ids against the roster.

## `/api/npc-talk`  (Iter 45)

Two-NPC short exchange when co-located. Returns 2 lines (one per NPC).

Request:
```json
{
  "a": { "id": "right_hand", "displayName": "The Right Hand", "persona": "..." },
  "b": { "id": "cook", "displayName": "Mira", "persona": "..." },
  "flags": "...",
  "currentTime": "10:05 PM",
  "aRecentEvents": "...",
  "bRecentEvents": "..."
}
```

Response:
```json
{
  "lines": [
    { "npcId": "right_hand", "text": "He's gone quiet upstairs. I do not like it." },
    { "npcId": "cook", "text": "Then sit. Drink something. Watch the door." }
  ]
}
```

## Env

All four proxies read `GROQ_API_KEY` from `.env` (gitignored). Optional `GROQ_MODEL` overrides the default `llama-3.3-70b-versatile`.

## Multiplayer wire (no proxy)

Trystero handles peer-to-peer directly from the browser via Nostr relays (no signaling server). See `src/multiplayer.ts` for action channels: `pos` (10 Hz position), `chat` (free text), `state` (kind+payload for kill / clue / log events).
