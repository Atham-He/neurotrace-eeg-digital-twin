# Contributing

1. Create a short-lived branch from `main`.
2. Keep one product or validation concern per pull request.
3. Run `npm run verify` before requesting review.
4. Visually check baseline, onset, recruitment, recovery and quality-gate states.
5. Do not commit patient EEG, credentials, tokens, generated `dist/`, or unlicensed anatomy assets.
6. Preserve the BodyParts3D attribution when changing or redistributing the GLB.

Changes to event detection, brain mapping or medical-facing text must include an updated test case and a review of the research-only boundary.
