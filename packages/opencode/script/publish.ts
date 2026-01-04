#!/usr/bin/env bun
import { $ } from "bun"
import pkg from "../package.json"
import { Script } from "@opencode-ai/script"
import { fileURLToPath } from "url"
import buildConfig from "../../../build.config"

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)

// Check if npm publishing is enabled (disabled for forks by default)
const PUBLISH_NPM = Bun.env.OPENCODE_PUBLISH_NPM === "true"
// Check if docker publishing is enabled (disabled for forks by default)
const PUBLISH_DOCKER = Bun.env.OPENCODE_PUBLISH_DOCKER === "true"

const { binaries } = await import("./build.ts")
{
  const name = `${pkg.name}-${process.platform}-${process.arch}`
  console.log(`smoke test: running dist/${name}/bin/opencode --version`)
  await $`./dist/${name}/bin/opencode --version`
}

await $`mkdir -p ./dist/${pkg.name}`
await $`cp -r ./bin ./dist/${pkg.name}/bin`
await $`cp ./script/postinstall.mjs ./dist/${pkg.name}/postinstall.mjs`

await Bun.file(`./dist/${pkg.name}/package.json`).write(
  JSON.stringify(
    {
      name: pkg.name + "-ai",
      bin: {
        [pkg.name]: `./bin/${pkg.name}`,
      },
      scripts: {
        postinstall: "bun ./postinstall.mjs || node ./postinstall.mjs",
      },
      version: Script.version,
      optionalDependencies: binaries,
    },
    null,
    2,
  ),
)

// npm publishing (disabled for forks)
if (PUBLISH_NPM) {
  const tags = [Script.channel]

  const tasks = Object.entries(binaries).map(async ([name]) => {
    if (process.platform !== "win32") {
      await $`chmod -R 755 .`.cwd(`./dist/${name}`)
    }
    await $`bun pm pack`.cwd(`./dist/${name}`)
    for (const tag of tags) {
      await $`npm publish *.tgz --access public --tag ${tag}`.cwd(`./dist/${name}`)
    }
  })
  await Promise.all(tasks)
  for (const tag of tags) {
    await $`cd ./dist/${pkg.name} && bun pm pack && npm publish *.tgz --access public --tag ${tag}`
  }
} else {
  console.log("Skipping npm publish (OPENCODE_PUBLISH_NPM not set)")
}

if (!Script.preview) {
  // Create archives for GitHub release
  for (const key of Object.keys(binaries)) {
    if (key.includes("linux")) {
      await $`tar -czf ../../${key}.tar.gz *`.cwd(`dist/${key}/bin`)
    } else {
      await $`zip -r ../../${key}.zip *`.cwd(`dist/${key}/bin`)
    }
  }

  // Docker publishing (disabled for forks)
  if (PUBLISH_DOCKER) {
    const image = buildConfig.docker.image
    const platforms = "linux/amd64,linux/arm64"
    const tags = [`${image}:${Script.version}`, `${image}:latest`]
    const tagFlags = tags.flatMap((t) => ["-t", t])
    await $`docker buildx build --platform ${platforms} ${tagFlags} --push .`
  } else {
    console.log("Skipping docker publish (OPENCODE_PUBLISH_DOCKER not set)")
  }
}
