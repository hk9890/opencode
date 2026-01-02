import { cmd } from "./cmd"
import { Plugin } from "../../plugin"
import { Instance } from "../../project/instance"
import { EOL } from "os"

const PluginListCommand = cmd({
  command: "list",
  describe: "list all active plugins",
  async handler() {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        const plugins = await Plugin.listInfo()
        for (const plugin of plugins) {
          process.stdout.write(`${plugin.name}@${plugin.version}${EOL}`)
        }
      },
    })
  },
})

export const PluginCommand = cmd({
  command: "plugin",
  describe: "manage plugins",
  builder: (yargs) => yargs.command(PluginListCommand).demandCommand(),
  async handler() {},
})
