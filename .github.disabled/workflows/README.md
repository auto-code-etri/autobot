# Disabled GitHub Workflows

This directory preserves the upstream Continue GitHub Actions configuration without
allowing it to run in the Autobot repository.

## Why these workflows are disabled

Autobot currently tracks Continue `v2.0.0-vscode` as its baseline, but the upstream
workflows assume Continue-owned infrastructure such as release secrets, GitHub
Pages setup, Runloop/Snyk integrations, scheduled maintenance jobs, and PR artifact
republishing. Those assumptions do not match `HansolChoe/autobot`, so keeping the
workflows active causes failing or unnecessary automation.

## Re-enabling a workflow

To re-enable a workflow, move only the required workflow file back to
`.github/workflows/`, verify the referenced local actions and repository secrets,
and test it from a separate branch before merging to `main`.

Do not re-enable the upstream workflow set wholesale. Add a small Autobot-specific
CI workflow instead when the project needs active validation.
