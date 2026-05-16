# Long Watch — Design Doc

## Premise

Matriarch Magrath "Red Sky" Fletcher hires the party to defend her Heir Wallace from an assassin who is coming tonight. Survive until dawn (5:00 AM).

## Three Phases

1. **The Long Watch** (9:00 PM → assassin arrival)
   - Explore mansion, meet cast, search for clues
   - Find out who the Boss is (1d8 table)
   - Notice plot Twist (1d8) if any
   - Each major action burns in-game minutes (event-clock hybrid)
2. **The Attack** (assassin arrives between 11 PM and 4 AM)
   - Initiative rolled. Real D&D 5e combat.
   - Surprise round if party is asleep / spread out
3. **The Payout** (dawn or earlier)
   - Heir lives → 1000 gp (+ 1000 if conclusive Boss evidence)
   - Heir dies → run out of town

## Mansion Layout

### Floor 0 — Cellar
- **Wine Cellar** — barrels, brandy (Boozer objective). Hidden stash.
- **Storage Room** — old furniture as cover, locked chest (DC 15)
- **Secret Passage** — exits to the docks. Assassin can use this entry.

### Floor 1 — Ground
1. **Entry Hall** — main door, grand staircase, suit of armor (cover)
2. **Matriarch's Study** — desk, ledgers, **letters reveal Forsythe clue**, fireplace
3. **Library** — bookshelves (DC 15 Investigation = secret passage)
4. **Dining Hall** — long table, wine cabinet, chandelier (drop trap?)
5. **Kitchen** — staff working, knives, ovens, side door to Servants' Hall
6. **Servants' Hall** — staff break room, **side entrance** to outside
7. **Drawing Room** — piano, sofas, fireplace
8. **Courtyard** — open, fountain, locked iron gate
9. **Garden** — herb beds, statues (cover for assassin approach)

### Floor 2 — Upper
10. **Heir's Bedroom** — primary target; locked door; window (assassin entry vector)
11. **Matriarch's Bedroom** — hidden safe, jewelry, possible doppelganger giveaway
12. **Guest Rooms** (x2) — where the adventurers stage
13. **Right Hand's Office** — maps of the city, daggers, **token of his loyalty (or betrayal clue)**
14. **Servants' Quarters** — beds, personal effects
15. **Upper Balcony** — wraps around Entry Hall, overlook for ranged defense

### Footprint
~50 x 50 voxel grid, 2 main floors + small cellar. Each room 6-10 voxels wide. Cellar accessed via stairs in Servants' Hall.

## The Cast

| NPC | Role | Stat block | Personality |
|---|---|---|---|
| **Magrath Fletcher** ("Red Sky") | Matriarch, employer | Veteran | Iron will, terse, sultry voice, used to obedience. Wants security. |
| **Wallace Fletcher** | Heir, the target | Noble (max HP) | Reedy young man, nervous, sheltered. Asks too many questions. |
| **The Right Hand** | Matriarch's enforcer / spy | Spy | Late 30s, deep red scarves. Loyal - or so it seems. |
| **Household staff** | 4-6 commoners | Commoner | Cook, butler, maid, gardener, stable hand. Some know more than they let on. |

## Plot Tables

### Boss (1d8) — who paid for the hit

| Roll | Boss | Clue |
|------|------|------|
| 1 | The Forewaters (rival merchants) | History / Investigation in criminal underworld |
| 2 | The Assassin's Guild | Assassin carries Guild token |
| 3 | The Sea Goddess of Chaos | Assassin's symbols / Religion check |
| 4 | Forsythe Forewater (jilted suitor) | Letters in Matriarch's study |
| 5 | The Unseelie Court | Assassin under geas spell |
| 6 | **Sunder** (sentient sword commanding the assassin) | Weapon on assassin's body |
| 7 | The Right Hand (internal betrayal) | Observation, Insight checks |
| 8 | No one — assassin is freelance | No clue |

### Assassin (1d6) — who comes for the Heir

| Roll | Assassin | Notes |
|------|----------|-------|
| 1 | Mooks (gang of 4-5) | 30s gangster vibe; mob trait against fear |
| 2 | Cult of Umberlee | Priest + Cult Fanatic + Giant Toad |
| 3 | The Crimson Angel | Single solo assassin, leaves blood-wing calling card |
| 4 | Sebek-Ari (Yuan-ti) | Summons swarm of snakes on round 1 |
| 5 | Mezzoloth (summoned) | Summoner hidden somewhere in mansion |
| 6 | Air Elemental (summoned) | Same — find/kill cultist to dispel |

### Twist (1d8)

| Roll | Twist |
|------|-------|
| 1 | None |
| 2 | Heir is already poisoned — adrenaline triggers it |
| 3 | Assassin is connected to a party member |
| 4 | Heir fakes his own death (Cult conversion) |
| 5 | Matriarch is a doppelganger |
| 6 | Heir is a daughter, not a son |
| 7 | Heir is a blue dragon wyrmling in disguise |
| 8 | Two twists (re-roll, discard 1 and 8) |

### Secret Objectives (1d12)

Per player. Hidden from others. Visible to player on the Objective Card.

1. Oblivious - no objective
2. Thief - steal as much loot as possible
3. Saboteur - only you and the Heir survive
4. Pacifist - no sentient creature dies tonight
5. Smitten - win the affection of someone
6. Seeker - possess the Heir's ruby necklace by morning
7. Protector - take damage in place of 2+ allies
8. Accomplice - the assassin must survive (you also know assassin identity)
9. Celebrity - get the killing blow on the assassin (or convincingly claim it)
10. Boozer - get drunk
11. Leader - devise a plan; party must follow it
12. Traitor - the Heir must die (you also know the Boss)

## Game Clock — Hybrid Event + Idle

Start: **9:00 PM**. Dawn: **5:00 AM**.

| Action | Minutes |
|---|---|
| Enter a new room | 2 |
| Short NPC chat (scripted node) | 10 |
| Deep NPC interrogation (AI free-text exchange) | 5 per exchange |
| Skill check / Investigation / Search | 15 |
| Read a document | 5 |
| Drink at the bar | 15 |
| Rest 1 hour | 60 |

Idle walking does **not** burn clock.

Assassin arrival = `11:00 PM + 1d6 hours` (rolled at start, hidden). Combat doesn't burn clock.

30-minute warning: ambient audio cue (footsteps echo, candle flicker).

## AI NPC Guardrails

All proxied through `vite.config.ts -> /api/npc-chat -> Groq Llama 3.3 70B`.

System prompt template:
- Strict character lock
- Reply <=2 sentences, <=280 chars
- Match player language
- Forbidden topics list (meta, AI, game mechanics)
- Knows / doesn't know hard-coded per NPC
- Deflect in character on probes

## Multiplayer Roadmap

- MVP: solo, browser local state
- v1: 4-player co-op via Colyseus (Node WS server)
- Server holds authoritative game state. Assigns secret objectives. Hidden info routed to correct client only.
- Spectator / DM mode for host

## Source

Adapted with respect from *The Contract: A One-Shot Adventure in D&D 5th Edition* by Lucas Zellers (Scintilla Studio, 2020). Personal/learning project. Original PDF (c) Lucas Zellers, not redistributed.
