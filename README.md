# Camera & Lens Selection Tool

Compare machine-vision sensors and lenses — sensor size to scale, 3D
field-of-view visualization, lens/sensor compatibility checks, and
resolution comparisons — instead of doing the math by hand from
datasheets.

- [`docs/requirements.md`](docs/requirements.md) — what this is and why
- [`docs/architecture.md`](docs/architecture.md) — stack and system design
- [`docs/LEARNINGS.md`](docs/LEARNINGS.md) — setup steps, problems hit,
  decisions made, and what's tested vs. not

## Quickstart

```
nvm use            # or ensure node -v is 20+
npm install
npm run dev         # frontend on :5173, local API dev server on :8787
```

Datasheet-link import needs an Anthropic API key:

```
cp .env.local.example .env.local
# fill in ANTHROPIC_API_KEY
```

Everything else (manual entry, the seed dataset, sensor comparison, FOV
visualization, the comparison table) works with no configuration.

```
npm run test         # unit tests for the optics/calculation module
npm run typecheck
npm run lint
npm run build
```
