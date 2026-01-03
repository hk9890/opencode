import { For, Show } from "solid-js"

export type BannerLine = [string, string]

export interface TextBannerProps {
  lines: BannerLine[]
  class?: string
}

export function TextBanner(props: TextBannerProps) {
  return (
    <Show when={props.lines.length > 0}>
      <pre
        classList={{
          "font-mono text-sm leading-tight select-none whitespace-pre": true,
          [props.class ?? ""]: !!props.class,
        }}
      >
        <For each={props.lines}>
          {(line) => (
            <div>
              <span class="text-text-weak">{line[0]}</span>
              <span class="text-text-strong">{line[1]}</span>
            </div>
          )}
        </For>
      </pre>
    </Show>
  )
}
