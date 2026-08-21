# Contributing

## Branches and pull requests

- Branch from the latest `main` using `feat/`, `fix/`, `docs/` or `chore/`.
- Use imperative commit subjects, for example `Improve temporal-onset focus treatment`.
- Keep generated `dist/`, `.openai/`, local recordings and screenshots out of commits.
- Open pull requests as drafts while work is in progress.
- Describe product intent, implementation scope, validation and any remaining risk.

## Definition of done

- `npm run verify` passes.
- The baseline, onset and spread chapters remain synchronized.
- Keyboard, pointer and touch interactions remain usable.
- No controls overlap at 1440×900, 1280×720 and 768×1024.
- Visible changes include before/after screenshots in the pull request.
- Medical claims, patient identifiers and real clinical data are not introduced.
- New third-party assets include provenance and redistribution terms.

## Code conventions

- Prefer small, named functions and explicit state transitions.
- Preserve deterministic synthetic EEG output unless a change is intentional and documented.
- Keep anatomical region identifiers aligned between the GLB node names and `ANATOMY` in `eeg-demo.js`.
- Use semantic HTML and accessible labels for every interactive control.
- Avoid adding dependencies when the browser platform or existing Three.js surface is sufficient.

## Review focus

Reviewers should prioritize scientific framing, interaction regressions, responsive layout, rendering performance and asset licensing. This repository is a demonstration surface, not a validated clinical algorithm.
