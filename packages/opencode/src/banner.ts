import fs from "fs"
import path from "path"
import { Global } from "./global"
import { Flag } from "./flag/flag"
import z from "zod"

export namespace Banner {
  const DEFAULT_BANNER = [
    [`                    `, `             ▄     `],
    [`█▀▀█ █▀▀█ █▀▀█ █▀▀▄ `, `█▀▀▀ █▀▀█ █▀▀█ █▀▀█`],
    [`█░░█ █░░█ █▀▀▀ █░░█ `, `█░░░ █░░█ █░░█ █▀▀▀`],
    [`▀▀▀▀ █▀▀▀ ▀▀▀▀ ▀  ▀ `, `▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀`],
  ]

  const BANNER_FILENAME = "banner.txt"

  export const Info = z.object({
    lines: z.array(z.array(z.string())),
    source: z.string(),
  })
  export type Info = z.infer<typeof Info>

  function findBannerUp(start: string): string | undefined {
    let current = start
    while (true) {
      const candidate = path.join(current, ".opencode", BANNER_FILENAME)
      if (fs.existsSync(candidate)) return candidate
      const parent = path.dirname(current)
      if (parent === current) break
      current = parent
    }
    return undefined
  }

  function parseBanner(content: string): string[][] {
    const lines = content.split("\n")
    if (lines.length > 0 && lines[lines.length - 1] === "") {
      lines.pop()
    }
    return lines.map((line) => {
      const parts = line.split("|")
      if (parts.length >= 2) {
        return [parts[0], parts.slice(1).join("|")]
      }
      return ["", line]
    })
  }

  export function load(cwd?: string): Info {
    const locations: string[] = []

    // 1. Project .opencode directory (search up from cwd)
    const projectBanner = findBannerUp(cwd ?? process.cwd())
    if (projectBanner) locations.push(projectBanner)

    // 2. Global config directory
    locations.push(path.join(Global.Path.config, BANNER_FILENAME))

    // 3. OPENCODE_CONFIG_DIR if set
    if (Flag.OPENCODE_CONFIG_DIR) {
      locations.push(path.join(Flag.OPENCODE_CONFIG_DIR, BANNER_FILENAME))
    }

    for (const location of locations) {
      if (!fs.existsSync(location)) continue
      const content = fs.readFileSync(location, "utf-8")
      return {
        lines: parseBanner(content),
        source: location,
      }
    }

    return {
      lines: DEFAULT_BANNER,
      source: "default",
    }
  }
}
