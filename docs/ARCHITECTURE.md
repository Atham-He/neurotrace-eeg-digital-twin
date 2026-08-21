# Architecture

## Runtime flow

```text
24-second playback clock
        |
        +--> deterministic EEG renderer --> eight canvas traces and signal metrics
        |
        +--> seizure state model ---------> baseline / focal onset / spread
        |
        +--> Three.js scene --------------> material, focus and propagation effects
        |
        +--> UI state --------------------> timeline, chapters, labels and controls
```

`eeg-demo.js` owns one playback clock so the biosignal, anatomical state and interface never drift into independent timelines. The case constants `DURATION`, `ONSET` and `SPREAD` define the three narrative phases.

## Anatomical model

`assets/anatomy/brain-anatomy.glb` exposes 24 named meshes. Each name maps to an entry in `ANATOMY`, which supplies layer membership, color, baseline opacity and a Chinese label. Do not rename a GLB node without updating this mapping.

The browser loads Three.js, OrbitControls and GLTFLoader from a pinned jsDelivr URL. The application has no runtime backend and stores no user or patient data.

## Build output

`npm run build` creates a Cloudflare Worker-compatible static bundle:

- `dist/client/` contains the browser assets.
- `dist/server/index.js` delegates requests to static assets and preserves the legacy `/eeg-demo.html` redirect.

Generated output is disposable and should never be committed.

## Extension seams

- Replace synthetic EEG samples behind the renderer without changing the playback contract.
- Add a case manifest before supporting multiple recordings.
- Keep clinical annotations separate from raw signal payloads.
- Add automated screenshot tests only after representative viewport baselines are approved.
