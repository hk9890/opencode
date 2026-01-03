import { TextAttributes } from "@opentui/core"
import { For } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { Banner } from "@/banner"

const banner = Banner.load()

export function Logo() {
  const { theme } = useTheme()
  return (
    <box>
      <For each={banner.lines}>
        {(line) => (
          <box flexDirection="row">
            <text fg={theme.textMuted} selectable={false}>
              {line[0]}
            </text>
            <text fg={theme.text} attributes={TextAttributes.BOLD} selectable={false}>
              {line[1]}
            </text>
          </box>
        )}
      </For>
    </box>
  )
}
