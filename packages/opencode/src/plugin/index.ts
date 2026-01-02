import type { Hooks, PluginInput, Plugin as PluginInstance } from "@opencode-ai/plugin"
import { Config } from "../config/config"
import { Bus } from "../bus"
import { Log } from "../util/log"
import { createOpencodeClient } from "@opencode-ai/sdk"
import { Server } from "../server/server"
import { BunProc } from "../bun"
import { Instance } from "../project/instance"
import { Flag } from "../flag/flag"

export namespace Plugin {
  const log = Log.create({ service: "plugin" })

  const BUILTIN = ["opencode-copilot-auth@0.0.9", "opencode-anthropic-auth@0.0.5"]

  export type Info = {
    name: string
    version: string
  }

  const state = Instance.state(async () => {
    const client = createOpencodeClient({
      baseUrl: "http://localhost:4096",
      // @ts-ignore - fetch type incompatibility
      fetch: async (...args) => Server.App().fetch(...args),
    })
    const config = await Config.get()
    const hooks: Hooks[] = []
    const infos: Info[] = []
    const input: PluginInput = {
      client,
      project: Instance.project,
      worktree: Instance.worktree,
      directory: Instance.directory,
      serverUrl: Server.url(),
      $: Bun.$,
    }

    const disabled = new Set(config.disabled_plugins ?? [])
    const enabled = config.enabled_plugins ? new Set(config.enabled_plugins) : null

    function isPluginAllowed(pluginName: string): boolean {
      if (enabled && !enabled.has(pluginName)) return false
      if (disabled.has(pluginName)) return false
      return true
    }

    const plugins = [...(config.plugin ?? [])]
    if (!Flag.OPENCODE_DISABLE_DEFAULT_PLUGINS) {
      plugins.push(...BUILTIN)
    }
    for (let plugin of plugins) {
      // Extract plugin name and version for filtering (handle versioned names like "pkg@1.0.0")
      const lastAtIndex = plugin.lastIndexOf("@")
      const pluginName = lastAtIndex > 0 ? plugin.substring(0, lastAtIndex) : plugin
      const pluginVersion = lastAtIndex > 0 ? plugin.substring(lastAtIndex + 1) : "latest"
      if (!isPluginAllowed(pluginName)) {
        log.info("skipping disabled plugin", { plugin: pluginName })
        continue
      }
      log.info("loading plugin", { path: plugin })
      const isLocalFile = plugin.startsWith("file://")
      if (!isLocalFile) {
        const builtin = BUILTIN.some((x) => x.startsWith(pluginName + "@"))
        plugin = await BunProc.install(pluginName, pluginVersion).catch((err) => {
          if (builtin) return ""
          throw err
        })
        if (!plugin) continue
      }
      const mod = await import(plugin)
      // Prevent duplicate initialization when plugins export the same function
      // as both a named export and default export (e.g., `export const X` and `export default X`).
      // Object.entries(mod) would return both entries pointing to the same function reference.
      const seen = new Set<PluginInstance>()
      for (const [_name, fn] of Object.entries<PluginInstance>(mod)) {
        if (seen.has(fn)) continue
        seen.add(fn)
        const init = await fn(input)
        hooks.push(init)
      }
      infos.push({
        name: isLocalFile ? plugin : pluginName,
        version: isLocalFile ? "local" : pluginVersion,
      })
    }

    return {
      hooks,
      infos,
      input,
    }
  })

  export async function trigger<
    Name extends Exclude<keyof Required<Hooks>, "auth" | "event" | "tool">,
    Input = Parameters<Required<Hooks>[Name]>[0],
    Output = Parameters<Required<Hooks>[Name]>[1],
  >(name: Name, input: Input, output: Output): Promise<Output> {
    if (!name) return output
    for (const hook of await state().then((x) => x.hooks)) {
      const fn = hook[name]
      if (!fn) continue
      // @ts-expect-error if you feel adventurous, please fix the typing, make sure to bump the try-counter if you
      // give up.
      // try-counter: 2
      await fn(input, output)
    }
    return output
  }

  export async function list() {
    return state().then((x) => x.hooks)
  }

  export async function listInfo() {
    return state().then((x) => x.infos)
  }

  export async function init() {
    const hooks = await state().then((x) => x.hooks)
    const config = await Config.get()
    for (const hook of hooks) {
      // @ts-expect-error this is because we haven't moved plugin to sdk v2
      await hook.config?.(config)
    }
    Bus.subscribeAll(async (input) => {
      const hooks = await state().then((x) => x.hooks)
      for (const hook of hooks) {
        hook["event"]?.({
          event: input,
        })
      }
    })
  }
}
