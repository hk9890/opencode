#!/usr/bin/env bun

import { Script } from "@opencode-ai/script"
import { $ } from "bun"

// Check if registry publishing is enabled (disabled for forks by default)
const PUBLISH_REGISTRIES = Bun.env.OPENCODE_PUBLISH_REGISTRIES === "true"

if (!Script.preview) {
  await $`gh release edit v${Script.version} --draft=false`
}

// Only download and publish to registries (AUR, Homebrew) if enabled
if (PUBLISH_REGISTRIES) {
  await $`bun install`
  await $`gh release download --pattern "opencode-linux-*64.tar.gz" --pattern "opencode-darwin-*64.zip" -D dist`
  await import(`../packages/opencode/script/publish-registries.ts`)
} else {
  console.log("Skipping registry publish (OPENCODE_PUBLISH_REGISTRIES not set)")
  console.log("Release has been finalized on GitHub.")
}
