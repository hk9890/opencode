# Logging Issue Analysis

## Summary

Logging is not working for TUI sessions when running the production `opencode` binary. Log files are not being created for new sessions, while local development (`bun dev`) works correctly.

## Symptoms

- Running `opencode` (production binary) starts a TUI session but no log file is created
- Running `bun run src/index.ts` (local dev) correctly writes to `~/.local/share/opencode/log/dev.log`
- Standalone `opencode serve` commands DO create log files
- The issue appears to be specific to the TUI command flow

## Investigation Timeline

### Git History Analysis

Key commits affecting logging in `src/util/log.ts`:

| Date         | Commit      | Change                                                                                 |
| ------------ | ----------- | -------------------------------------------------------------------------------------- |
| Nov 5, 2025  | `2a9b6a85d` | Introduced `let write: (msg: string) => void` - write was undefined until `Log.init()` |
| Nov 5, 2025  | `4e7bfaab8` | Changed to `let write = process.stderr.write` - loses `this` context                   |
| Nov 5, 2025  | `247ce4477` | Changed to `let write = (msg: any) => Bun.stderr.write(msg)`                           |
| Nov 5, 2025  | `6555a33ef` | Made file write function `async` - **callers don't await**                             |
| Dec 11, 2025 | `755a79cd8` | Changed `Bun.stderr.write` to `process.stderr.write` (CPU pinning fix)                 |
| Dec 11, 2025 | `5b21334fd` | Added `return msg.length` to write function                                            |

### Root Causes Identified

#### 1. Async Write Function Not Awaited

In commit `6555a33ef`, the file write function was made async:

```typescript
write = async (msg: any) => {
  const num = writer.write(msg)
  writer.flush()
  return num
}
```

But the logger methods do NOT await it:

```typescript
debug(message?: any, extra?: Record<string, any>) {
  if (shouldLog("DEBUG")) {
    write("DEBUG " + build(message, extra))  // NOT awaited!
  }
}
```

This could cause writes to not complete before process operations continue or exit.

#### 2. Missing Await for Cleanup

Line 60 in `Log.init()`:

```typescript
cleanup(Global.Path.log) // NOT awaited!
```

The `cleanup()` function is async but not awaited, running in parallel with the rest of initialization.

#### 3. Race Condition Between Main Process and Worker

The TUI architecture:

1. **Main process** (`index.ts`) - runs yargs middleware which calls `Log.init()`
2. **Worker process** (`worker.ts`) - spawns separately, has its own `Log.init()`

Both processes:

- May create different log files (timestamped filenames based on current time)
- Both truncate their log file with `fs.truncate(logpath).catch(() => {})`
- Both reassign the global `write` function

#### 4. Silent Error Handling

The `fs.truncate()` call silently catches all errors:

```typescript
await fs.truncate(logpath).catch(() => {})
```

If the file doesn't exist (new timestamped log), truncate fails silently. While `Bun.file().writer()` should create the file, the error suppression makes debugging difficult.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Main Process (TUI)                       │
│  index.ts → middleware → Log.init() → TuiThreadCommand      │
│                           │                                  │
│                           ▼                                  │
│                    Creates log file                          │
│                    (timestamped or dev.log)                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ spawns Worker
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Worker Process                           │
│  worker.ts → Log.init() → Server.listen()                   │
│                  │                                           │
│                  ▼                                           │
│           Creates ANOTHER log file                           │
│           (potentially different timestamp)                  │
└─────────────────────────────────────────────────────────────┘
```

## Log File Behavior

| Scenario              | `Installation.isLocal()` | Log Filename                          |
| --------------------- | ------------------------ | ------------------------------------- |
| Local dev (`bun dev`) | `true`                   | `dev.log` (fixed)                     |
| Production binary     | `false`                  | `YYYY-MM-DDTHHMMSS.log` (timestamped) |

For local dev, both processes use the same `dev.log` file. For production, they may create different timestamped files if there's any time difference between initialization.

## Proposed Fixes

### Option 1: Await the Cleanup Call

```typescript
export async function init(options: Options) {
  if (options.level) level = options.level
  await cleanup(Global.Path.log) // Add await
  // ...
}
```

### Option 2: Make Write Synchronous

Remove `async` from the file write function or ensure callers await:

```typescript
write = (msg: any) => {
  const num = writer.write(msg)
  writer.flush()
  return num
}
```

### Option 3: Single-Process Logging

Have only the Worker handle file logging. The main process can:

- Use the existing `/log` server endpoint to send logs to the Worker
- Or skip file logging entirely (only stderr when `--print-logs`)

### Option 4: Add File Creation Explicitly

Ensure the log file is created before getting a writer:

```typescript
await Bun.write(logpath, "") // Create empty file
const logfile = Bun.file(logpath)
const writer = logfile.writer()
```

## Files Involved

- `src/util/log.ts` - Core logging module
- `src/index.ts` - Main CLI entry, calls `Log.init()` in middleware
- `src/cli/cmd/tui/worker.ts` - Worker process, has its own `Log.init()`
- `src/cli/cmd/tui/thread.ts` - Spawns the Worker
- `src/installation/index.ts` - `isLocal()` determines dev vs production mode
- `src/global/index.ts` - Defines `Global.Path.log` directory

## Testing

To verify logging works:

```bash
# Local dev (should write to dev.log)
bun run src/index.ts debug paths
cat ~/.local/share/opencode/log/dev.log

# Production binary (should create timestamped log)
opencode debug paths
ls -la ~/.local/share/opencode/log/

# TUI with print-logs (logs to stderr)
opencode --print-logs
```

## Related Issues

- CPU pinning issue when using `Bun.stderr.write` (#5396)
- Export command piping interference (commit `2a9b6a85d`)
