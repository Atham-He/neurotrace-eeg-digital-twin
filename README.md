# NeuroTrace EEG Digital Twin

NeuroTrace is an executive-grade interactive demonstration of focal seizure evolution. It synchronizes a synthetic eight-channel EEG replay with a transparent, electrical-style 3D brain containing 24 anatomical structures.

> Research visualization demo only. It is not a medical device and must not be used for diagnosis or treatment decisions.

## Live demo

[Open the current private demo](https://neurotrace-eeg-digital-twin.gautoreview.chatgpt.site)

## Product surface

- 24-second guided case replay with baseline, focal onset and network-spread chapters
- Eight-channel synthetic bipolar EEG rendering at a simulated 256 Hz
- Three.js anatomical digital twin with 24 selectable structures and six visibility layers
- Synchronized seizure-onset highlighting, propagation effects and quantitative indicators
- Presentation mode, camera presets, timeline scrubbing, speed control and responsive layouts

## Quick start

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4173`.

Run the complete local verification before opening a pull request:

```bash
npm run verify
```

The production bundle is generated in `dist/` and is intentionally excluded from version control.

## Repository map

| Path | Purpose |
| --- | --- |
| `index.html` | Semantic application shell and social metadata |
| `eeg-demo.css` | Responsive visual system and presentation layouts |
| `eeg-demo.js` | EEG simulation, Three.js scene and interaction state |
| `assets/anatomy/` | 24-region GLB model and its third-party license |
| `scripts/build-site.mjs` | Deterministic deployment bundle generator |
| `scripts/build_brain_glb.py` | Rebuilds the GLB from licensed BodyParts3D archives |
| `docs/` | Architecture, demo and data-governance notes |

## Collaboration workflow

1. Create a short-lived branch from `main`, for example `feat/eeg-channel-controls`.
2. Keep one product concern per pull request.
3. Run `npm run verify` and perform a visual check at desktop and tablet widths.
4. Open a draft pull request early and attach screenshots for visible changes.
5. Request review before merging to `main`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the complete convention.

## Data and licensing

The EEG case is synthetic and contains no patient data. The anatomical GLB is derived from BodyParts3D and is distributed under CC BY-SA 2.1 Japan; see [the asset license](assets/anatomy/LICENSE.md). Application code is MIT licensed.
