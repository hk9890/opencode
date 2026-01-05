---
description: Trigger a GitHub release build
---

Trigger a release for this fork. Run the appropriate gh command based on the arguments.

## Arguments

- `$1` - Version bump type (patch, minor, major) OR specific version number (e.g., 1.2.3)

## Instructions

1. If `$1` is "patch", "minor", or "major":

   ```bash
   gh workflow run publish.yml --repo hk9890/opencode -f bump="$1"
   ```

2. If `$1` looks like a version number (e.g., "1.2.0"):

   ```bash
   gh workflow run publish.yml --repo hk9890/opencode -f version="$1"
   ```

3. If no argument provided, default to patch:

   ```bash
   gh workflow run publish.yml --repo hk9890/opencode -f bump=patch
   ```

4. After triggering, show the user the link to watch the build:
   ```
   https://github.com/hk9890/opencode/actions/workflows/publish.yml
   ```

## Examples

- `/release` - triggers patch release
- `/release patch` - triggers patch release
- `/release minor` - triggers minor release
- `/release 1.2.0` - triggers release with specific version
