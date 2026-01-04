#!/usr/bin/env bun

import { Script } from "@opencode-ai/script"
import { $ } from "bun"

// Check if npm publishing is enabled (disabled for forks by default)
const PUBLISH_NPM = Bun.env.OPENCODE_PUBLISH_NPM === "true"

const dir = new URL("..", import.meta.url).pathname
process.chdir(dir)

await import("./build")

const pkg = await import("../package.json").then((m) => m.default)
const original = JSON.parse(JSON.stringify(pkg))
for (const [key, value] of Object.entries(pkg.exports)) {
  const file = value.replace("./src/", "./dist/").replace(".ts", "")
  /// @ts-expect-error
  pkg.exports[key] = {
    import: file + ".js",
    types: file + ".d.ts",
  }
}
await Bun.write("package.json", JSON.stringify(pkg, null, 2))
await $`bun pm pack`

if (PUBLISH_NPM) {
  await $`npm publish *.tgz --tag ${Script.channel} --access public`
} else {
  console.log("Skipping npm publish for SDK (OPENCODE_PUBLISH_NPM not set)")
}

await Bun.write("package.json", JSON.stringify(original, null, 2))
