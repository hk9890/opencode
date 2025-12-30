# OpenCode SDK Usage Guide

This guide explains how to use the OpenCode SDK to programmatically access session data, including messages, tool calls (with inputs/outputs), and real-time events. This is useful for building session analyzers, debugging tools, or integrating OpenCode into other workflows.

## Table of Contents

- [Installation](#installation)
- [Starting the Server](#starting-the-server)
- [Connecting a Client](#connecting-a-client)
- [Fetching Session Data](#fetching-session-data)
- [Processing Messages and Parts](#processing-messages-and-parts)
- [Determining Tool Success/Failure](#determining-tool-successfailure)
- [Subscribing to Real-Time Events (SSE)](#subscribing-to-real-time-events-sse)
- [Complete Example: Session Analyzer](#complete-example-session-analyzer)
- [Type Reference](#type-reference)

---

## Installation

Install the OpenCode SDK from npm:

```bash
npm install @opencode-ai/sdk
```

Or with other package managers:

```bash
# yarn
yarn add @opencode-ai/sdk

# pnpm
pnpm add @opencode-ai/sdk

# bun
bun add @opencode-ai/sdk
```

---

## Starting the Server

The SDK communicates with OpenCode via a local HTTP server. You have two options:

### Option 1: Combined Server + Client (Recommended)

Use `createOpencode()` to start a server and get a connected client in one call:

```typescript
import { createOpencode } from "@opencode-ai/sdk"

async function main() {
  // Starts server and creates client
  const { client, server } = await createOpencode({
    port: 4096, // Optional: custom port
  })

  try {
    // Use the client...
    const sessions = await client.session.list()
    console.log("Sessions:", sessions.data)
  } finally {
    // Always clean up
    server.close()
  }
}
```

### Option 2: Manual Server + Client

For more control, start the server and client separately:

```typescript
import { createOpencodeServer, createOpencodeClient } from "@opencode-ai/sdk"

async function main() {
  // Start the server
  const server = await createOpencodeServer({
    hostname: "127.0.0.1", // Default
    port: 4096, // Default
    timeout: 5000, // Startup timeout in ms
  })

  console.log("Server URL:", server.url)

  // Create a client connected to the server
  const client = createOpencodeClient({
    baseUrl: server.url,
    directory: process.cwd(), // Optional: specify project directory
  })

  try {
    // Use the client...
  } finally {
    server.close()
  }
}
```

### Server Options

```typescript
type ServerOptions = {
  hostname?: string // Default: "127.0.0.1"
  port?: number // Default: 4096
  signal?: AbortSignal // For cancellation
  timeout?: number // Startup timeout in ms, default: 5000
  config?: Config // Optional configuration to pass to server
}
```

---

## Connecting a Client

If you already have an OpenCode server running (e.g., from the TUI), you can connect directly:

```typescript
import { createOpencodeClient } from "@opencode-ai/sdk"

const client = createOpencodeClient({
  baseUrl: "http://127.0.0.1:4096", // Your server URL
  directory: "/path/to/project", // Optional: project directory
})
```

---

## Fetching Session Data

### List All Sessions

```typescript
const response = await client.session.list()
const sessions = response.data // Array of Session objects

for (const session of sessions) {
  console.log(`${session.id}: ${session.title}`)
  console.log(`  Created: ${new Date(session.time.created).toISOString()}`)
  console.log(`  Updated: ${new Date(session.time.updated).toISOString()}`)
}
```

### Get Session Info

```typescript
const response = await client.session.get({
  path: { sessionID: "ses_xxxxx" },
})
const session = response.data

console.log("Session:", session.title)
console.log("Project:", session.projectID)
console.log("Directory:", session.directory)
```

### Get All Messages with Parts (The Key Endpoint!)

This is the main endpoint for accessing complete session data including tool calls:

```typescript
const response = await client.session.messages({
  path: { sessionID: "ses_xxxxx" },
  query: { limit: 100 }, // Optional: limit number of messages
})

const messages = response.data // Array of { info: Message, parts: Part[] }

for (const msg of messages) {
  console.log(`\n=== ${msg.info.role} message ===`)
  console.log("Message ID:", msg.info.id)

  for (const part of msg.parts) {
    console.log(`  Part type: ${part.type}`)
  }
}
```

### Get File Diffs

```typescript
const response = await client.session.diff({
  path: { sessionID: "ses_xxxxx" },
})

const diffs = response.data // Array of FileDiff

for (const diff of diffs) {
  console.log(`File: ${diff.file}`)
  console.log(`  +${diff.additions} -${diff.deletions}`)
  // diff.before and diff.after contain full file contents
}
```

---

## Processing Messages and Parts

### Message Types

Messages are either `user` or `assistant`:

```typescript
import type { Message, UserMessage, AssistantMessage } from "@opencode-ai/sdk"

function processMessage(msg: { info: Message; parts: Part[] }) {
  if (msg.info.role === "user") {
    const userMsg = msg.info as UserMessage
    console.log("User message")
    console.log("  Agent:", userMsg.agent)
    console.log("  Model:", `${userMsg.model.providerID}/${userMsg.model.modelID}`)
  }

  if (msg.info.role === "assistant") {
    const assistantMsg = msg.info as AssistantMessage
    console.log("Assistant message")
    console.log("  Model:", `${assistantMsg.providerID}/${assistantMsg.modelID}`)
    console.log("  Cost: $", assistantMsg.cost.toFixed(4))
    console.log("  Tokens:", assistantMsg.tokens)
    console.log("  Finish reason:", assistantMsg.finish)

    // Check for message-level errors
    if (assistantMsg.error) {
      console.log("  ERROR:", assistantMsg.error.name, assistantMsg.error.data)
    }
  }
}
```

### Part Types

Each message contains an array of parts. The `Part` type is a discriminated union:

```typescript
import type { Part, ToolPart } from "@opencode-ai/sdk"

function processPart(part: Part) {
  switch (part.type) {
    case "text":
      // User input or assistant response text
      console.log("Text:", part.text)
      break

    case "tool":
      // Tool call with input/output
      console.log("Tool:", part.tool)
      console.log("  Call ID:", part.callID)
      console.log("  Status:", part.state.status)
      processToolState(part as ToolPart)
      break

    case "reasoning":
      // Model's reasoning/thinking (for models that support it)
      console.log("Reasoning:", part.text)
      break

    case "file":
      // Attached file
      console.log("File:", part.filename, part.mime)
      break

    case "step-start":
      // Start of an LLM step
      console.log("Step started, snapshot:", part.snapshot)
      break

    case "step-finish":
      // End of an LLM step with token usage
      console.log("Step finished")
      console.log("  Reason:", part.reason)
      console.log("  Cost: $", part.cost.toFixed(4))
      console.log("  Tokens:", part.tokens)
      break

    case "patch":
      // Files changed in this step
      console.log("Files changed:", part.files)
      break

    case "retry":
      // API retry attempt
      console.log("Retry attempt:", part.attempt)
      console.log("  Error:", part.error.data.message)
      break

    case "compaction":
      // Session was compacted (context overflow handling)
      console.log("Compaction:", part.auto ? "automatic" : "manual")
      break

    case "agent":
      // Agent switch
      console.log("Agent:", part.name)
      break

    case "subtask":
      // Subtask delegation
      console.log("Subtask:", part.description)
      console.log("  Agent:", part.agent)
      console.log("  Prompt:", part.prompt)
      break

    case "snapshot":
      // Git snapshot reference
      console.log("Snapshot:", part.snapshot)
      break
  }
}
```

---

## Determining Tool Success/Failure

Tool parts have a `state` field that indicates the tool's execution status. This is crucial for analyzing what went well vs. what failed.

### Tool State Types

```typescript
import type { ToolPart, ToolState } from "@opencode-ai/sdk"

type ToolStatus = "pending" | "running" | "completed" | "error"
```

### Processing Tool State

```typescript
function processToolState(toolPart: ToolPart): void {
  const { tool, callID, state } = toolPart

  switch (state.status) {
    case "pending":
      // Tool call initiated, input being parsed
      console.log(`[PENDING] ${tool}`)
      console.log("  Raw input:", state.raw)
      break

    case "running":
      // Tool is currently executing
      console.log(`[RUNNING] ${tool}`)
      console.log("  Input:", JSON.stringify(state.input, null, 2))
      console.log("  Started:", new Date(state.time.start).toISOString())
      if (state.title) {
        console.log("  Title:", state.title)
      }
      break

    case "completed":
      // Tool finished successfully
      console.log(`[SUCCESS] ${tool}`)
      console.log("  Input:", JSON.stringify(state.input, null, 2))
      console.log("  Output:", state.output)
      console.log("  Title:", state.title)
      console.log("  Duration:", state.time.end - state.time.start, "ms")

      // Check if output was compacted (truncated due to context limits)
      if (state.time.compacted) {
        console.log("  WARNING: Output was compacted at", new Date(state.time.compacted).toISOString())
      }

      // Tool-specific metadata (e.g., exit code for bash)
      if (state.metadata) {
        console.log("  Metadata:", state.metadata)
      }

      // Some tools return file attachments
      if (state.attachments?.length) {
        console.log(
          "  Attachments:",
          state.attachments.map((a) => a.filename),
        )
      }
      break

    case "error":
      // Tool execution failed
      console.log(`[ERROR] ${tool}`)
      console.log("  Input:", JSON.stringify(state.input, null, 2))
      console.log("  Error:", state.error)
      console.log("  Duration:", state.time.end - state.time.start, "ms")
      break
  }
}
```

### Helper Functions for Analysis

```typescript
import type { ToolPart } from "@opencode-ai/sdk"

function isToolSuccess(toolPart: ToolPart): boolean {
  return toolPart.state.status === "completed"
}

function isToolError(toolPart: ToolPart): boolean {
  return toolPart.state.status === "error"
}

function getToolError(toolPart: ToolPart): string | null {
  if (toolPart.state.status === "error") {
    return toolPart.state.error
  }
  return null
}

function getToolOutput(toolPart: ToolPart): string | null {
  if (toolPart.state.status === "completed") {
    return toolPart.state.output
  }
  return null
}

function getToolDuration(toolPart: ToolPart): number | null {
  const state = toolPart.state
  if (state.status === "completed" || state.status === "error") {
    return state.time.end - state.time.start
  }
  return null
}

function isOutputCompacted(toolPart: ToolPart): boolean {
  if (toolPart.state.status === "completed") {
    return !!toolPart.state.time.compacted
  }
  return false
}
```

### Message-Level Errors

Assistant messages can also have errors (e.g., API failures, aborts):

```typescript
import type { AssistantMessage } from "@opencode-ai/sdk"

function checkMessageError(msg: AssistantMessage): void {
  if (!msg.error) return

  switch (msg.error.name) {
    case "ProviderAuthError":
      console.log("Auth error for provider:", msg.error.data.providerID)
      console.log("Message:", msg.error.data.message)
      break

    case "APIError":
      console.log("API error:", msg.error.data.message)
      console.log("Status code:", msg.error.data.statusCode)
      console.log("Retryable:", msg.error.data.isRetryable)
      break

    case "MessageAbortedError":
      console.log("Message was aborted:", msg.error.data.message)
      break

    case "MessageOutputLengthError":
      console.log("Output length exceeded")
      break

    case "UnknownError":
      console.log("Unknown error:", msg.error.data.message)
      break
  }
}
```

---

## Subscribing to Real-Time Events (SSE)

OpenCode provides a Server-Sent Events (SSE) endpoint for real-time updates. This is useful for monitoring active sessions.

### Event Types

The SDK defines many event types. Key ones for session analysis:

| Event                  | Description                                         |
| ---------------------- | --------------------------------------------------- |
| `message.updated`      | Message metadata changed                            |
| `message.removed`      | Message was removed                                 |
| `message.part.updated` | Part added or updated (includes tool state changes) |
| `message.part.removed` | Part was removed                                    |
| `session.created`      | New session created                                 |
| `session.updated`      | Session metadata changed                            |
| `session.deleted`      | Session was deleted                                 |
| `session.status`       | Session status changed (idle/busy/retry)            |
| `session.error`        | Session-level error occurred                        |
| `session.diff`         | File diffs updated for session                      |
| `permission.updated`   | Permission request created                          |
| `permission.replied`   | Permission request answered                         |

### Subscribing to Events

```typescript
import type { GlobalEvent } from "@opencode-ai/sdk"

async function subscribeToEvents(baseUrl: string) {
  const eventSource = new EventSource(`${baseUrl}/global/event`)

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data) as GlobalEvent

    console.log("Event:", data.payload.type)

    switch (data.payload.type) {
      case "message.part.updated":
        const part = data.payload.properties.part
        if (part.type === "tool") {
          console.log(`Tool ${part.tool} status: ${part.state.status}`)
        }
        break

      case "session.status":
        console.log(`Session ${data.payload.properties.sessionID} is ${data.payload.properties.status.type}`)
        break

      case "session.error":
        console.log("Session error:", data.payload.properties.error)
        break
    }
  }

  eventSource.onerror = (error) => {
    console.error("SSE error:", error)
  }

  return eventSource
}
```

### Using with Node.js

Node.js doesn't have native `EventSource`. Use a library like `eventsource`:

```bash
npm install eventsource
```

```typescript
import EventSource from "eventsource"

const eventSource = new EventSource(`${serverUrl}/global/event`)
// ... same as above
```

---

## Complete Example: Session Analyzer

Here's a complete script that analyzes a session and outputs statistics:

```typescript
#!/usr/bin/env npx tsx
// save as: analyze-session.ts
// run: npx tsx analyze-session.ts <session-id>

import { createOpencode } from "@opencode-ai/sdk"
import type { ToolPart, AssistantMessage, FileDiff } from "@opencode-ai/sdk"

interface ToolStats {
  count: number
  success: number
  errors: number
  totalTimeMs: number
  errorMessages: string[]
}

interface SessionAnalysis {
  session: {
    id: string
    title: string
    created: string
    updated: string
  }
  stats: {
    totalCost: number
    totalTokens: {
      input: number
      output: number
      reasoning: number
      cacheRead: number
      cacheWrite: number
    }
    messageCount: number
    userMessages: number
    assistantMessages: number
    toolCalls: Record<string, ToolStats>
    errors: Array<{
      type: string
      message: string
      context?: Record<string, unknown>
    }>
    filesChanged: number
  }
  diffs: FileDiff[]
}

async function analyzeSession(sessionID: string): Promise<SessionAnalysis> {
  const { client, server } = await createOpencode()

  try {
    // Fetch all data in parallel
    const [sessionRes, messagesRes, diffsRes] = await Promise.all([
      client.session.get({ path: { sessionID } }),
      client.session.messages({ path: { sessionID } }),
      client.session.diff({ path: { sessionID } }),
    ])

    const session = sessionRes.data
    const messages = messagesRes.data
    const diffs = diffsRes.data

    // Initialize stats
    const stats: SessionAnalysis["stats"] = {
      totalCost: 0,
      totalTokens: {
        input: 0,
        output: 0,
        reasoning: 0,
        cacheRead: 0,
        cacheWrite: 0,
      },
      messageCount: messages.length,
      userMessages: 0,
      assistantMessages: 0,
      toolCalls: {},
      errors: [],
      filesChanged: diffs.length,
    }

    // Process messages
    for (const msg of messages) {
      if (msg.info.role === "user") {
        stats.userMessages++
      }

      if (msg.info.role === "assistant") {
        stats.assistantMessages++
        const assistantMsg = msg.info as AssistantMessage

        // Accumulate costs and tokens
        stats.totalCost += assistantMsg.cost || 0
        stats.totalTokens.input += assistantMsg.tokens?.input || 0
        stats.totalTokens.output += assistantMsg.tokens?.output || 0
        stats.totalTokens.reasoning += assistantMsg.tokens?.reasoning || 0
        stats.totalTokens.cacheRead += assistantMsg.tokens?.cache?.read || 0
        stats.totalTokens.cacheWrite += assistantMsg.tokens?.cache?.write || 0

        // Check for message-level errors
        if (assistantMsg.error) {
          stats.errors.push({
            type: assistantMsg.error.name,
            message: (assistantMsg.error.data as { message?: string }).message || "Unknown error",
            context: { messageID: assistantMsg.id },
          })
        }
      }

      // Process parts
      for (const part of msg.parts) {
        if (part.type === "tool") {
          processToolPart(part, stats)
        }
      }
    }

    return {
      session: {
        id: session.id,
        title: session.title,
        created: new Date(session.time.created).toISOString(),
        updated: new Date(session.time.updated).toISOString(),
      },
      stats,
      diffs,
    }
  } finally {
    server.close()
  }
}

function processToolPart(toolPart: ToolPart, stats: SessionAnalysis["stats"]): void {
  const toolName = toolPart.tool

  // Initialize tool stats if needed
  if (!stats.toolCalls[toolName]) {
    stats.toolCalls[toolName] = {
      count: 0,
      success: 0,
      errors: 0,
      totalTimeMs: 0,
      errorMessages: [],
    }
  }

  const toolStats = stats.toolCalls[toolName]
  toolStats.count++

  const state = toolPart.state

  if (state.status === "completed") {
    toolStats.success++
    toolStats.totalTimeMs += state.time.end - state.time.start
  } else if (state.status === "error") {
    toolStats.errors++
    toolStats.errorMessages.push(state.error)
    toolStats.totalTimeMs += state.time.end - state.time.start

    stats.errors.push({
      type: "ToolError",
      message: state.error,
      context: {
        tool: toolName,
        input: state.input,
      },
    })
  }
}

function printAnalysis(analysis: SessionAnalysis): void {
  console.log("\n" + "=".repeat(60))
  console.log("SESSION ANALYSIS")
  console.log("=".repeat(60))

  console.log("\n## Session Info")
  console.log(`  ID: ${analysis.session.id}`)
  console.log(`  Title: ${analysis.session.title}`)
  console.log(`  Created: ${analysis.session.created}`)
  console.log(`  Updated: ${analysis.session.updated}`)

  console.log("\n## Overview")
  console.log(`  Total Cost: $${analysis.stats.totalCost.toFixed(4)}`)
  console.log(
    `  Messages: ${analysis.stats.messageCount} (${analysis.stats.userMessages} user, ${analysis.stats.assistantMessages} assistant)`,
  )
  console.log(`  Files Changed: ${analysis.stats.filesChanged}`)

  console.log("\n## Token Usage")
  const tokens = analysis.stats.totalTokens
  console.log(`  Input: ${tokens.input.toLocaleString()}`)
  console.log(`  Output: ${tokens.output.toLocaleString()}`)
  console.log(`  Reasoning: ${tokens.reasoning.toLocaleString()}`)
  console.log(`  Cache Read: ${tokens.cacheRead.toLocaleString()}`)
  console.log(`  Cache Write: ${tokens.cacheWrite.toLocaleString()}`)

  console.log("\n## Tool Calls")
  const toolEntries = Object.entries(analysis.stats.toolCalls)
  if (toolEntries.length === 0) {
    console.log("  No tool calls")
  } else {
    for (const [tool, stats] of toolEntries) {
      const avgTime = stats.count > 0 ? Math.round(stats.totalTimeMs / stats.count) : 0
      const successRate = stats.count > 0 ? ((stats.success / stats.count) * 100).toFixed(1) : "N/A"
      console.log(`  ${tool}:`)
      console.log(`    Count: ${stats.count}`)
      console.log(`    Success: ${stats.success} (${successRate}%)`)
      console.log(`    Errors: ${stats.errors}`)
      console.log(`    Avg Duration: ${avgTime}ms`)
    }
  }

  if (analysis.stats.errors.length > 0) {
    console.log("\n## Errors")
    for (const error of analysis.stats.errors) {
      console.log(`  [${error.type}] ${error.message}`)
      if (error.context) {
        console.log(`    Context: ${JSON.stringify(error.context)}`)
      }
    }
  }

  console.log("\n" + "=".repeat(60))
}

// Main
async function main() {
  const sessionID = process.argv[2]

  if (!sessionID) {
    console.error("Usage: npx tsx analyze-session.ts <session-id>")
    console.error("")
    console.error("To find session IDs, run: opencode export")
    process.exit(1)
  }

  try {
    console.log(`Analyzing session: ${sessionID}`)
    const analysis = await analyzeSession(sessionID)

    // Print human-readable analysis
    printAnalysis(analysis)

    // Optionally output JSON
    if (process.argv.includes("--json")) {
      console.log("\n## Full JSON Output")
      console.log(JSON.stringify(analysis, null, 2))
    }
  } catch (error) {
    console.error("Error analyzing session:", error)
    process.exit(1)
  }
}

main()
```

### Running the Analyzer

```bash
# Basic analysis
npx tsx analyze-session.ts ses_xxxxx

# With full JSON output
npx tsx analyze-session.ts ses_xxxxx --json

# Save JSON to file
npx tsx analyze-session.ts ses_xxxxx --json > analysis.json
```

---

## Type Reference

### Key Types

```typescript
// Session
type Session = {
  id: string
  projectID: string
  directory: string
  parentID?: string
  title: string
  version: string
  time: {
    created: number
    updated: number
    compacting?: number
  }
  summary?: {
    additions: number
    deletions: number
    files: number
    diffs?: FileDiff[]
  }
  share?: { url: string }
  revert?: {
    messageID: string
    partID?: string
    snapshot?: string
    diff?: string
  }
}

// Message (discriminated union)
type Message = UserMessage | AssistantMessage

type UserMessage = {
  id: string
  sessionID: string
  role: "user"
  time: { created: number }
  agent: string
  model: { providerID: string; modelID: string }
  system?: string
  tools?: Record<string, boolean>
  summary?: {
    title?: string
    body?: string
    diffs: FileDiff[]
  }
}

type AssistantMessage = {
  id: string
  sessionID: string
  role: "assistant"
  parentID: string
  time: { created: number; completed?: number }
  modelID: string
  providerID: string
  mode: string
  path: { cwd: string; root: string }
  cost: number
  tokens: {
    input: number
    output: number
    reasoning: number
    cache: { read: number; write: number }
  }
  finish?: string
  summary?: boolean
  error?: ProviderAuthError | UnknownError | MessageOutputLengthError | MessageAbortedError | ApiError
}

// Part (discriminated union)
type Part =
  | TextPart
  | ToolPart
  | ReasoningPart
  | FilePart
  | StepStartPart
  | StepFinishPart
  | SnapshotPart
  | PatchPart
  | AgentPart
  | RetryPart
  | CompactionPart
  | { type: "subtask"; prompt: string; description: string; agent: string }

// Tool Part (the key type for analysis)
type ToolPart = {
  id: string
  sessionID: string
  messageID: string
  type: "tool"
  callID: string
  tool: string
  state: ToolState
  metadata?: Record<string, unknown>
}

// Tool State (discriminated union)
type ToolState = ToolStatePending | ToolStateRunning | ToolStateCompleted | ToolStateError

type ToolStatePending = {
  status: "pending"
  input: Record<string, unknown>
  raw: string
}

type ToolStateRunning = {
  status: "running"
  input: Record<string, unknown>
  title?: string
  metadata?: Record<string, unknown>
  time: { start: number }
}

type ToolStateCompleted = {
  status: "completed"
  input: Record<string, unknown>
  output: string
  title: string
  metadata: Record<string, unknown>
  time: {
    start: number
    end: number
    compacted?: number // If set, output was truncated
  }
  attachments?: FilePart[]
}

type ToolStateError = {
  status: "error"
  input: Record<string, unknown>
  error: string
  metadata?: Record<string, unknown>
  time: { start: number; end: number }
}

// Session Status (for real-time monitoring)
type SessionStatus =
  | { type: "idle" }
  | { type: "busy" }
  | { type: "retry"; attempt: number; message: string; next: number }

// File Diff
type FileDiff = {
  file: string
  before: string
  after: string
  additions: number
  deletions: number
}
```

### API Methods Summary

| Method                                                                             | Description                |
| ---------------------------------------------------------------------------------- | -------------------------- |
| `client.session.list()`                                                            | List all sessions          |
| `client.session.get({ path: { sessionID } })`                                      | Get session info           |
| `client.session.messages({ path: { sessionID } })`                                 | Get messages with parts    |
| `client.session.diff({ path: { sessionID } })`                                     | Get file diffs             |
| `client.session.status()`                                                          | Get status of all sessions |
| `client.session.children({ path: { sessionID } })`                                 | Get forked child sessions  |
| `client.session.todo({ path: { sessionID } })`                                     | Get session todo list      |
| `client.session.create({ body: { title? } })`                                      | Create new session         |
| `client.session.delete({ path: { sessionID } })`                                   | Delete session             |
| `client.session.abort({ path: { sessionID } })`                                    | Abort running session      |
| `client.session.share({ path: { sessionID } })`                                    | Share session              |
| `client.session.summarize({ path: { sessionID }, body: { providerID, modelID } })` | Summarize/compact session  |

---

## Additional Resources

- [OpenCode Documentation](https://opencode.ai/docs)
- [OpenCode GitHub Repository](https://github.com/sst/opencode)
- OpenAPI Specification: See `packages/sdk/openapi.json` in the repository for the full API schema
