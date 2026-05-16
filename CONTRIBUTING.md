# Contributing

Pull requests welcome. The project is iteratively built — see `docs/STATE.md` for the iteration log and `docs/DEV.md` for setup.

## Local setup

```bash
git clone https://github.com/FaintKom/long-watch.git
cd long-watch
npm install
cp .env.example .env   # add GROQ_API_KEY
npm run dev
```

## Workflow

1. Pick an item from the backlog (see open issues or `docs/STATE.md` iteration log for ideas).
2. Branch: `git checkout -b iterNN-short-description`.
3. Code + add tests in `tests/` if behavior is non-trivial.
4. Run the checks:
   ```bash
   npm test         # 39+ Vitest unit tests must stay green
   npx tsc --noEmit # strict TypeScript must pass
   npx vite build   # production build must succeed
   ```
5. Commit message style: `Iter NN: short title\n\nbody...\n\nCo-Authored-By:` — match the rest of `git log`.
6. Open a PR. Include before/after for any UI change.

## Code conventions

- TypeScript strict mode. No `// @ts-ignore`.
- One module per concern (`src/combat.ts`, `src/witnesses.ts`, etc.). Keep `main.ts` thin and procedural.
- Side-effects only in apply/tick functions — pure resolvers in standalone modules so they're testable.
- Comment **why**, not what. Heavy doc blocks at the top of new modules — see `src/combat.ts`, `src/memory.ts` as templates.
- Bilingual NPC text: Russian + English both fine, match the user's input language in prompts.

## Testing

- Vitest in `tests/`. Match `tests/<topic>.test.ts`.
- Use `seedrandom` to stabilise `Math.random` in tests that consume dice.
- Avoid mocking the world if a pure resolver exists — extend the resolver to take inputs instead.

## What needs help

Open the backlog in `docs/STATE.md` (search "Iter") to see in-progress threads. Areas with friction now:

- Hand-modeled `.vox` files (see `tools/README-vox.md`)
- Mansion props detail pass (paintings, rugs, furniture)
- Mobile control polish (existing scaffold in `index.html` `#mobile-controls`)
- A11y pass (keyboard-only nav for menus, ARIA, color-blind ring colors)
- Multi-floor A* via stair portals (currently single-floor)
- Procedural music (Tone.js generative)

## Reporting bugs

Open an issue with: seed, class chosen, browser, console errors, steps to reproduce. The seed alone reproduces the plot rolls + catacombs layout deterministically.

## License

By contributing you agree your code is MIT-licensed. The original adventure remains (c) Lucas Zellers and is not redistributed.
