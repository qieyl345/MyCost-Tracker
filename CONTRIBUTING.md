# Contributing

Thanks for considering a contribution. The repository contains a static book marketplace and a separate Next.js app at `mycost-tracker/`; keep changes scoped to the intended app.

## Before opening a pull request

1. Read the [Code of Conduct](CODE_OF_CONDUCT.md) and [Security Policy](SECURITY.md).
2. Check existing issues and [starter issue suggestions](docs/STARTER_ISSUES.md). The suggestions are not published GitHub issues unless an issue is created separately.
3. Keep data-backed claims tied to official sources and show the method for derived values. Do not add fabricated metrics, user quotes, or screenshots.
4. Do not commit credentials, private data, generated build outputs, or unreviewed deployment configuration.

## Local checks

For MyCost Tracker:

```powershell
cd mycost-tracker
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

For the existing marketplace, follow its setup guide and use a Firebase project you control. Do not use shared credentials or test against another person's data.

## Pull requests

Use the pull request template. Describe the user-visible change, list checks actually run, and include before/after screenshots for visual changes when available. Clearly identify any check or screenshot that could not be completed.
