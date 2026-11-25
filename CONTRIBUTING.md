# Contributing to APEX RUSH

Thanks for your interest! Bug reports, ideas and pull requests are welcome.

## Getting started

```bash
corepack enable
pnpm install
pnpm dev          # game on http://localhost:5173/Race/
```

Before opening a pull request, make sure everything passes:

```bash
pnpm lint
pnpm typecheck
pnpm test         # unit tests (Vitest)
pnpm test:e2e     # browser tests (Playwright)
```

## Project structure

The code is split into packages with clear interfaces – see [docs/architecture.md](docs/architecture.md). Please keep it that way:

- A package only uses another package through its `src/index.ts`, never its internal files.
- Game values (car stats, points, lap limits, colors) belong in `packages/shared`, not in scattered constants.
- New UI texts are written in German in the code and get an English entry in `packages/shared/src/i18n.ts`.
- The AI (`packages/ai`) must stay fair: same car, same physics and no information a human player would not have.

## Guidelines

- Small, working commits; `main` must always be playable.
- Every new feature needs visible or audible feedback (sound, particles, camera shake or UI animation).
- Add or extend tests for new logic.
- Only free assets (CC0 or similar). Add every asset to `assets/manifest.json` and `assets/CREDITS.md`.
- No real car brands, logos or characters from other games.
- Never commit secrets or personal data.

## Retraining the AI driver

```bash
pnpm ai:all   # record → train → evolve → evaluate → report (fixed seeds, reproducible)
```

If the model changes, update the numbers in `docs/ai-driver.md` so they match `docs/ai/report.md`.

## License

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
