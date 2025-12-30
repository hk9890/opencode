# OpenCode SDK Testing Guide

Use the OpenCode SDK to programmatically test AI coding capabilities. This guide covers starting a server, creating sessions for each test, sending prompts, and verifying results.

---

## Installation

```bash
npm install @opencode-ai/sdk
# or
bun add @opencode-ai/sdk
```

---

## Start the server

Use `createOpencode()` for a combined server and client setup:

```typescript
import { createOpencode, createOpencodeServer, createOpencodeClient } from "@opencode-ai/sdk"

// Option 1: Combined (recommended)
const { client, server } = await createOpencode({
  port: 4096,
  hostname: "127.0.0.1",
  timeout: 5000,
  config: {
    model: "anthropic/claude-sonnet-4-20250514",
    permission: { edit: "allow", bash: "allow" },
  },
})

// Option 2: Manual
const server = await createOpencodeServer({ port: 4096, timeout: 5000 })
const client = createOpencodeClient({ baseUrl: server.url })
```

---

## Create sessions

Each test case should create a new session:

```typescript
const response = await client.session.create({ title: "Test: Create function" })
const sessionID = response.data.id
```

---

## Send prompts

Use `prompt` for synchronous execution that waits for completion:

```typescript
await client.session.prompt({
  sessionID,
  parts: [{ type: "text", text: "Create a hello world function" }],
})
```

Use `promptAsync` to return immediately and monitor via SSE or polling:

```typescript
await client.session.promptAsync({
  sessionID,
  parts: [{ type: "text", text: "Create a hello world function" }],
})
```

---

## Wait for completion

Poll the session status until it becomes idle:

```typescript
async function waitForIdle(client: OpencodeClient, sessionID: string, timeout = 60000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const status = await client.session.status()
    if (status.data[sessionID]?.type === "idle") return
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error("Timeout waiting for session to complete")
}
```

---

## Get results

Retrieve all messages and analyze the responses:

```typescript
const messages = await client.session.messages({ sessionID })

for (const msg of messages.data) {
  if (msg.info.role === "assistant") {
    for (const part of msg.parts) {
      if (part.type === "text") {
        console.log("Response:", part.text)
      }
      if (part.type === "tool") {
        console.log(`Tool: ${part.tool}, Status: ${part.state.status}`)
        if (part.state.status === "completed") {
          console.log("Output:", part.state.output)
        }
        if (part.state.status === "error") {
          console.log("Error:", part.state.error)
        }
      }
    }
  }
}
```

Get file diffs to see what changed:

```typescript
const diffs = await client.session.diff({ sessionID })

for (const diff of diffs.data) {
  console.log(`File: ${diff.file}, +${diff.additions}/-${diff.deletions}`)
}
```

---

## Clean up

Delete sessions after each test and close the server when done:

```typescript
// Delete session when done
await client.session.delete({ sessionID })

// Close server at end of test suite
server.close()
```

---

## Complete test framework example

Here's a full example using a test framework structure:

```typescript
import { createOpencode, OpencodeClient } from "@opencode-ai/sdk"
import { existsSync, mkdtempSync, rmSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

let client: OpencodeClient
let server: { url: string; close: () => void }
let testDir: string

// Start server before all tests
beforeAll(async () => {
  const result = await createOpencode({
    port: 4096,
    timeout: 10000,
    config: {
      model: "anthropic/claude-sonnet-4-20250514",
      permission: { edit: "allow", bash: "allow" },
    },
  })
  client = result.client
  server = result.server
})

// Create temp directory and session before each test
let sessionID: string
beforeEach(async () => {
  testDir = mkdtempSync(join(tmpdir(), "opencode-test-"))
  const response = await client.session.create({ title: "Test session" })
  sessionID = response.data.id
})

// Clean up after each test
afterEach(async () => {
  await client.session.delete({ sessionID })
  rmSync(testDir, { recursive: true, force: true })
})

// Close server after all tests
afterAll(() => {
  server.close()
})

// Helper to wait for session completion
async function waitForIdle(timeout = 60000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const status = await client.session.status()
    if (status.data[sessionID]?.type === "idle") return
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error("Timeout waiting for session")
}

// Example test
test("creates a hello world file", async () => {
  // Send prompt
  await client.session.prompt({
    sessionID,
    parts: [
      {
        type: "text",
        text: `Create a file called hello.ts in ${testDir} with a function that returns "Hello World"`,
      },
    ],
  })

  // Wait for completion
  await waitForIdle()

  // Verify file was created
  const filePath = join(testDir, "hello.ts")
  expect(existsSync(filePath)).toBe(true)

  // Verify content
  const content = readFileSync(filePath, "utf-8")
  expect(content).toContain("Hello World")
})
```

---

## Real-time monitoring (SSE)

Monitor session events in real-time using Server-Sent Events:

```typescript
const events = client.global.event()

for await (const event of events.stream) {
  const payload = event.payload

  switch (payload.type) {
    case "message.part.updated":
      const part = payload.properties.part
      if (part.type === "tool") {
        console.log(`Tool ${part.tool}: ${part.state.status}`)
      }
      break

    case "session.status":
      console.log(`Session ${payload.properties.sessionID}: ${payload.properties.status.type}`)
      break

    case "session.error":
      console.error("Session error:", payload.properties.error)
      break
  }
}
```

---

## Troubleshooting

### Server startup issues

**Port already in use**

Another OpenCode instance may be running on the same port.

```typescript
// Use a different port
const { client, server } = await createOpencode({ port: 4097 })
```

**Binary not in PATH**

The `opencode` binary must be installed and accessible.

```bash
# Verify installation
which opencode
```

**Startup timeout**

Increase the timeout if the server takes longer to start.

```typescript
const { client, server } = await createOpencode({ timeout: 10000 })
```

---

### Authentication issues

**No API keys configured**

Provider API keys must be configured in the environment or config.

```typescript
const { client, server } = await createOpencode({
  config: {
    provider: {
      anthropic: { api_key: process.env.ANTHROPIC_API_KEY },
    },
  },
})
```

**Rate limiting**

Implement retry logic with exponential backoff for rate-limited requests.

---

### Session state issues

**Session stuck in busy state**

Use `abort` to cancel a stuck session:

```typescript
await client.session.abort({ sessionID })
```

**Session not becoming idle**

Implement proper timeout handling and abort stuck sessions:

```typescript
async function waitForIdleOrAbort(sessionID: string, timeout = 60000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const status = await client.session.status()
    if (status.data[sessionID]?.type === "idle") return true
    await new Promise((r) => setTimeout(r, 1000))
  }
  await client.session.abort({ sessionID })
  return false
}
```

---

### Permission handling

**Tests blocking on permission requests**

Auto-allow permissions in config to prevent blocking:

```typescript
const { client, server } = await createOpencode({
  config: {
    permission: { edit: "allow", bash: "allow" },
  },
})
```

---

### Tool execution failures

**File operations failing**

Check tool error states and verify working directory:

```typescript
for (const msg of messages.data) {
  for (const part of msg.parts) {
    if (part.type === "tool" && part.state.status === "error") {
      console.error(`Tool ${part.tool} failed:`, part.state.error)
      console.error("Input:", JSON.stringify(part.state.input, null, 2))
    }
  }
}
```

**Bash commands failing**

Check the metadata for exit codes:

```typescript
if (part.type === "tool" && part.tool === "bash") {
  if (part.state.status === "completed") {
    const exitCode = part.state.metadata?.exitCode
    if (exitCode !== 0) {
      console.warn(`Command exited with code ${exitCode}`)
    }
  }
}
```

---

### Race conditions

**Starting prompts before previous ones complete**

Always wait for session to become idle before sending new prompts:

```typescript
await client.session.prompt({ sessionID, parts: [...] })
await waitForIdle(sessionID)

// Now safe to check results or send another prompt
await client.session.prompt({ sessionID, parts: [...] })
```

**Checking results too early**

Poll status before accessing messages or diffs:

```typescript
await waitForIdle(sessionID)
const messages = await client.session.messages({ sessionID })
```

---

### Resource cleanup

**Sessions not cleaned up**

Use try/finally blocks to ensure cleanup:

```typescript
let sessionID: string | undefined

try {
  const response = await client.session.create({ title: "Test" })
  sessionID = response.data.id
  // ... run test
} finally {
  if (sessionID) {
    await client.session.delete({ sessionID })
  }
}
```

**Server process orphaned**

Always close the server in afterAll or using a finally block:

```typescript
let server: { close: () => void } | undefined

try {
  const result = await createOpencode()
  server = result.server
  // ... run tests
} finally {
  server?.close()
}
```

---

### Flaky tests

**AI responses vary between runs**

Test for outcomes rather than exact content:

```typescript
// Bad: Testing exact content
expect(content).toBe('function hello() { return "Hello World" }')

// Good: Testing for expected behavior
expect(existsSync(filePath)).toBe(true)
expect(content).toContain("Hello")
expect(content).toMatch(/function|const|export/)
```

**Non-deterministic behavior**

Use flexible assertions that account for variation:

```typescript
// Check file was created, not exact content
const diffs = await client.session.diff({ sessionID })
expect(diffs.data.some((d) => d.file.endsWith("hello.ts"))).toBe(true)
```

---

### Working directory issues

**Tests affecting each other**

Use isolated temporary directories for each test:

```typescript
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

let testDir: string

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), "opencode-test-"))
})

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true })
})
```

**Files persisting between tests**

Clean up test directories in afterEach hooks. Reset git state if testing in a real repository.

---

### Timeout configurations

**Tests timing out**

Configure appropriate timeouts for long-running AI operations:

```typescript
// Increase test timeout
test("long running test", async () => {
  // ...
}, 120000) // 2 minute timeout

// Increase wait timeout
await waitForIdle(sessionID, 120000)
```

**Model speed variations**

Different models have different response times. Adjust timeouts accordingly:

```typescript
const timeouts = {
  "anthropic/claude-sonnet-4-20250514": 60000,
  "openai/gpt-4o": 90000,
  "anthropic/claude-opus-4": 120000,
}

await waitForIdle(sessionID, timeouts[modelId] ?? 60000)
```
