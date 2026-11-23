# Security Policy

## Reporting a vulnerability

Please report suspected vulnerabilities privately to the repository owner through [GitHub](https://github.com/qieyl345). If GitHub private vulnerability reporting is enabled for this repository, use that feature. Do not open a public issue or include credentials, tokens, private user data, or exploit details that would put users at risk.

Reports should identify the affected component and version or commit, describe the impact, and include safe reproduction steps where possible. Do not test against systems, accounts, or data you do not own or have permission to test.

## Scope and limitations

This repository includes a static marketplace prototype that connects to Firebase and an independently deployed MyCost Tracker. The marketplace's Firebase rules and any hosted deployment require project-owner review; this repository does not claim that they have received an independent security audit. Never commit secrets. Treat any credential that has been exposed in source or documentation as compromised and rotate it in the service that issued it.

There is no guaranteed response or remediation timeline. Please coordinate public disclosure with the maintainer.
