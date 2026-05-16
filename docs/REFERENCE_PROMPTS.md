# Reference Prompt Patterns

Distilled from [Bobby-Gray/claude-dnd-skill](https://github.com/Bobby-Gray/claude-dnd-skill) - a Claude Code skill for running 5e campaigns. Read for prompt-design ideas, do **not** import the skill directly. Long Watch is a single-night one-shot, but several of their conventions translate cleanly.

Source files:
- https://github.com/Bobby-Gray/claude-dnd-skill/blob/main/SKILL.md
- https://github.com/Bobby-Gray/claude-dnd-skill/blob/main/SKILL-commands.md

---

## 1. NPC Dialogue Voicing

**Pattern.** Every named NPC carries 2+ distinct traits (verbal tic, contradiction, hidden goal) loaded from a single block before any line of dialogue is generated.

> "a verbal tic, a visible contradiction, a motivation that makes them a person rather than a prop."

**Applied here.** Already implemented in `src/cast.ts` (10 rich-persona fields). To go further: when the Groq npc-chat proxy assembles the system prompt, inject ONLY that NPC's block plus their last 2 reflections (`src/memory.ts`) - not the whole 7-NPC roster - so distinct voices don't collapse into the mean.

## 2. DM Narration Style

**Pattern.** 2-3 sharp sensory beats per narration block; stop after the vivid hit.

> "Two or three sharp sensory details beat a paragraph of exposition every time."

**Applied here.** Cap event-feed lines at ~3 sensory beats. The mansion already has good physical anchors - guttering candles, floorboard creak, drip in the cistern. Bake "stop after the detail" into the system prompt so narration doesn't wander.

## 3. Turn-Based Combat Resolution

**Pattern.** Strict 7-step pipeline per turn. The most-missed step is sending narration bundled with ALL stat deltas in one atomic payload.

> "Step (f) is the most commonly missed. Every narration block must be sent."

**Applied here.** Even though Long Watch is mostly social, scuffles should follow: player intent -> roll -> roll-result event -> condition tick -> narration WITH stat patch (HP, fear, light source) in one atomic frame update -> advance turn. One transaction per turn prevents desync between voxel state and narrative state.

## 4. Clue & Investigation Reveals

**Pattern.** Re-read the source for every factual claim. Prefer a compact "Live State Flags" table over rehydrating the whole log. Distinguish *consequence* (durable world state) from *event* (deliverable beat).

> "survives when players pre-empt the obvious event delivery; events break and the beat goes stale."

**Applied here.** Store clues as consequences (`portrait_slashed=true`, `cellar_key_in_cook_pocket`) not as scripted reveal events. The player can encounter the slashed portrait via any path. Maintain a `state_flags` block that the Groq prompt consults before answering "what does X notice here."

## 5. Memory / State Persistence

**Pattern.** A small `state.md` of distilled patterns ("DM Style Notes" + "Faction Moves") is always-loaded core; full logs are archived and only re-read on demand.

> "Between sessions, active factions and NPCs don't stand still waiting to be found."

**Applied here.** Long Watch is a one-shot, so "between sessions" maps to **between scenes / between save-points**. After each manor beat, write a compact reflection per active NPC ("what they did off-screen, what they now believe about the player") into the reflections store. Reload only that distillation into each next Groq call. **This is already the shape of `src/memory.ts` reflections** - formalize the "off-screen action per NPC per beat" rule next.

---

## Top 3 patterns to steal next

1. **Atomic narration+stat-delta send (combat pattern f).** One frame, one payload, no desync between voxel world and prose.
2. **Consequence > event for clues.** Store world flags, not scripted reveals; survives any player path through the manor.
3. **Per-NPC distilled "style notes" reloaded every call.** Already partly there via reflections - formalize so each Groq npc-chat call gets style notes for ONLY the NPC speaking, not all seven.
