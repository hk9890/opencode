---
state: Draft
modification:
  - name: "@story-writer"
    date: 2025-12-22
    state: Draft
---

# Story 001: OpenCode Fork Customization

## Story Statement

**As a** developer forking OpenCode,
**I want** to customize the branding, remove cloud services, restrict providers, and modify system prompts,
**so that** I can create a self-contained, branded version of OpenCode tailored to my organization's needs.

## Acceptance Criteria

1. The welcome screen ASCII banner can be easily replaced with custom branding
2. All cloud/session sharing functionality is removed (no external API calls to opencode.ai or opncd.ai)
3. The import from shared URL feature is removed
4. System prompts can be customized for each supported provider
5. Only a configurable subset of LLM providers is available (hardcoded at build time)
6. The application builds and runs successfully with all customizations
7. No references to removed cloud services remain in the codebase
8. All existing tests pass (or are updated to reflect removed functionality)

## Tasks / Subtasks

### Task 1: Replace Welcome Screen Banner (AC: 1)

- [ ] 1.1 Modify `packages/opencode/src/cli/cmd/tui/component/logo.tsx`
  - [ ] Replace `LOGO_LEFT` and `LOGO_RIGHT` ASCII art arrays with custom branding
  - [ ] Optionally simplify the component to remove the `For` loop if single-color banner is desired
- [ ] 1.2 Test the new banner displays correctly with `bun dev`

### Task 2: Remove Cloud/Session Sharing Functionality (AC: 2, 3, 7)

- [ ] 2.1 Delete share module files
  - [ ] Delete `packages/opencode/src/share/share.ts`
  - [ ] Delete `packages/opencode/src/share/share-next.ts`
- [ ] 2.2 Remove share functionality from session module
  - [ ] Edit `packages/opencode/src/session/index.ts`
    - Remove `share`, `unshare`, `getShare` exports
    - Remove `ShareInfo` type
    - Remove auto-share logic on session creation
    - Remove `ShareNext.create()` and `ShareNext.remove()` calls
- [ ] 2.3 Remove share API endpoints from server
  - [ ] Edit `packages/opencode/src/server/server.ts`
    - Remove `/session/:sessionID/share` POST endpoint (lines ~916-946)
    - Remove `/session/:sessionID/share` DELETE endpoint (lines ~986-1016)
- [ ] 2.4 Remove share configuration options
  - [ ] Edit `packages/opencode/src/config/config.ts`
    - Remove `share` config field (lines ~633-642)
    - Remove `autoshare` deprecated field (line ~125-132)
    - Remove `session_share` keybind (line ~436)
    - Remove `session_unshare` keybind (line ~437)
- [ ] 2.5 Remove share flag
  - [ ] Edit `packages/opencode/src/flag/flag.ts`
    - Remove `OPENCODE_AUTO_SHARE` flag
- [ ] 2.6 Remove share CLI options
  - [ ] Edit `packages/opencode/src/cli/cmd/run.ts`
    - Remove `--share` CLI option
    - Remove auto-share logic
- [ ] 2.7 Remove URL import functionality
  - [ ] Edit `packages/opencode/src/cli/cmd/import.ts`
    - Remove shared URL import logic (lines ~31-67)
- [ ] 2.8 Remove share UI components
  - [ ] Edit `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx`
    - Remove share/unshare commands from command palette
  - [ ] Edit `packages/opencode/src/cli/cmd/tui/routes/session/header.tsx`
    - Remove share URL display
  - [ ] Edit `packages/opencode/src/cli/cmd/tui/routes/session/sidebar.tsx`
    - Remove share URL display
  - [ ] Edit `packages/opencode/src/cli/cmd/tui/event.ts`
    - Remove `"session.share"` event type
- [ ] 2.9 Remove GitHub agent share integration (optional - if GitHub agent is used)
  - [ ] Edit `packages/opencode/src/cli/cmd/github.ts`
    - Remove session sharing logic
    - Remove social card generation
    - Remove share URL in PR comments
- [ ] 2.10 Update/remove share-related tests
  - [ ] Edit `packages/opencode/test/config/config.test.ts`
    - Remove autoshare migration test (lines ~248-267)

### Task 3: Customize System Prompts (AC: 4)

- [ ] 3.1 Modify provider-specific prompts
  - [ ] Edit `packages/opencode/src/session/prompt/anthropic.txt` - Claude models
  - [ ] Edit `packages/opencode/src/session/prompt/beast.txt` - GPT-4/o1/o3 models
  - [ ] Edit `packages/opencode/src/session/prompt/codex.txt` - Codex models
  - [ ] Edit `packages/opencode/src/session/prompt/gemini.txt` - Google Gemini
  - [ ] Edit `packages/opencode/src/session/prompt/qwen.txt` - Qwen (default fallback)
- [ ] 3.2 Optionally modify agent prompts
  - [ ] Review `packages/opencode/src/agent/prompt/*.txt` for customization needs
- [ ] 3.3 Update branding references in prompts
  - [ ] Replace "OpenCode" references with custom branding name

### Task 4: Hardcode Allowed Providers (AC: 5)

- [ ] 4.1 Modify provider registry
  - [ ] Edit `packages/opencode/src/provider/provider.ts`
    - Update `BUNDLED_PROVIDERS` (lines ~32-44) to only include desired providers
    - Remove corresponding entries from `CUSTOM_LOADERS` (lines ~53-331)
- [ ] 4.2 Alternatively, hardcode filtering in state function
  - [ ] Edit `packages/opencode/src/provider/provider.ts`
    - Add hardcoded `allowedProviders` array in `state()` function (around line ~498)
    - Filter providers before returning
- [ ] 4.3 Remove unused provider dependencies from package.json (optional)
  - [ ] Edit `packages/opencode/package.json`
    - Remove SDK packages for disabled providers

### Task 5: Build and Test (AC: 6, 8)

- [ ] 5.1 Run TypeScript compilation to check for errors
  - [ ] `bun run build` in packages/opencode
- [ ] 5.2 Run test suite
  - [ ] `bun test` in packages/opencode
  - [ ] Fix any failing tests due to removed functionality
- [ ] 5.3 Manual testing
  - [ ] Test welcome screen displays custom banner
  - [ ] Test that share commands are not available
  - [ ] Test that only allowed providers are shown
  - [ ] Test that custom system prompts are used

### Task 6: Documentation (AC: 6)

- [ ] 6.1 Update README or create CUSTOMIZATION.md documenting changes
- [ ] 6.2 Document how to further customize the fork

## Dev Notes

### File Locations

#### Welcome Screen / Branding

| File                                                   | Purpose                    |
| ------------------------------------------------------ | -------------------------- |
| `packages/opencode/src/cli/cmd/tui/component/logo.tsx` | ASCII art banner component |
| `packages/opencode/src/cli/cmd/tui/routes/home.tsx`    | Home screen layout         |

#### Share/Cloud Services (to remove)

| File                                                           | Purpose                               |
| -------------------------------------------------------------- | ------------------------------------- |
| `packages/opencode/src/share/share.ts`                         | Legacy share module - DELETE          |
| `packages/opencode/src/share/share-next.ts`                    | New share module - DELETE             |
| `packages/opencode/src/session/index.ts`                       | Session module with share integration |
| `packages/opencode/src/server/server.ts`                       | HTTP API endpoints                    |
| `packages/opencode/src/config/config.ts`                       | Configuration schema                  |
| `packages/opencode/src/flag/flag.ts`                           | Feature flags                         |
| `packages/opencode/src/cli/cmd/run.ts`                         | CLI run command                       |
| `packages/opencode/src/cli/cmd/import.ts`                      | Import command                        |
| `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx`   | Session view with share commands      |
| `packages/opencode/src/cli/cmd/tui/routes/session/header.tsx`  | Header with share URL                 |
| `packages/opencode/src/cli/cmd/tui/routes/session/sidebar.tsx` | Sidebar with share URL                |
| `packages/opencode/src/cli/cmd/tui/event.ts`                   | Event types                           |

#### System Prompts

| File                                                 | Provider              |
| ---------------------------------------------------- | --------------------- |
| `packages/opencode/src/session/prompt/anthropic.txt` | Claude models         |
| `packages/opencode/src/session/prompt/beast.txt`     | GPT-4/o1/o3           |
| `packages/opencode/src/session/prompt/codex.txt`     | Codex                 |
| `packages/opencode/src/session/prompt/gemini.txt`    | Google Gemini         |
| `packages/opencode/src/session/prompt/qwen.txt`      | Qwen (default)        |
| `packages/opencode/src/session/system.ts`            | Prompt assembly logic |
| `packages/opencode/src/session/llm.ts`               | LLM integration       |

#### Provider Configuration

| File                                         | Purpose                       |
| -------------------------------------------- | ----------------------------- |
| `packages/opencode/src/provider/provider.ts` | Provider registry and loading |
| `packages/opencode/src/provider/models.ts`   | Model definitions             |

### External API Endpoints Being Removed

These endpoints will no longer be called after customization:

- `https://api.opencode.ai/share_create`
- `https://api.opencode.ai/share_sync`
- `https://api.opencode.ai/share_delete`
- `https://api.opencode.ai/share_data`
- `https://opncd.ai/api/share`
- `https://opncd.ai/api/share/:id/sync`
- `https://opncd.ai/api/share/:id`
- `https://social-cards.sst.dev/opencode-share/`

### Testing Requirements

1. **Unit Tests**: Run existing test suite, update tests that reference removed functionality
2. **Manual Testing**:
   - Verify banner displays correctly
   - Verify no share options appear in UI/CLI
   - Verify only allowed providers are available
   - Verify custom prompts are sent to LLM
3. **Build Verification**: Ensure clean TypeScript compilation

### Technical Constraints

- TypeScript compilation must pass with no errors
- Removed code should be cleanly excised (no dead imports, no unused variables)
- Provider filtering should happen at build/startup time, not runtime config

## Questions and Design Decisions

**Decision 1: Provider restriction approach**

- **Problem**: Should providers be hardcoded in code or configurable via config file?
- **Decision**: Hardcode in `provider.ts` by modifying `BUNDLED_PROVIDERS` and `CUSTOM_LOADERS`
- **Rationale**: This ensures providers cannot be re-enabled via config, providing stronger control for organizational deployments

**Open Question 1: Which providers should be allowed?**

- **Problem**: Need to know which LLM providers to keep in the hardcoded list
- **Options**:
  - `anthropic`, `openai` (most common)
  - `anthropic`, `openai`, `google-vertex` (enterprise)
  - `anthropic`, `openai`, `amazon-bedrock`, `azure` (enterprise cloud)
  - Custom selection from: `openrouter`, `github-copilot`, `groq`, `ollama`, etc.
- **Status**: OPEN - to be decided during implementation

**Open Question 2: Custom branding name**

- **Problem**: What should replace "OpenCode" in prompts and UI (ASCII banner, system prompts)?
- **Options**:
  - Keep "OpenCode" but modify logo
  - Use custom organization name
  - Use generic name like "Code Assistant"
- **Status**: OPEN - to be decided during implementation

**Open Question 3: GitHub agent handling**

- **Problem**: The GitHub agent (`packages/opencode/src/cli/cmd/github.ts`) has share integration. Should it be modified or removed entirely?
- **Options**:
  - Keep GitHub agent, only remove share-related code
  - Remove GitHub agent entirely
  - Keep as-is (not recommended)
- **Status**: OPEN - to be decided during implementation

**Question 2: Custom branding name**

- **Problem**: What should replace "OpenCode" in prompts and UI?
- **Status**: OPEN - needs user input

### Risks and Considerations

1. **Upstream Updates**: After forking, merging upstream changes may cause conflicts in modified files
2. **Breaking Changes**: Removing share functionality may break any workflows that depend on it
3. **Provider SDK Updates**: Hardcoding providers means manual updates when provider SDKs change

## Validation Report

| Category                             | Status | Issues                                                  |
| ------------------------------------ | ------ | ------------------------------------------------------- |
| 1. Goal & Context Clarity            | TBD    |                                                         |
| 2. Technical Implementation Guidance | TBD    |                                                         |
| 3. Reference Effectiveness           | TBD    |                                                         |
| 4. Self-Containment Assessment       | TBD    |                                                         |
| 5. Testing Guidance                  | TBD    |                                                         |
| 6. No open questions                 | TBD    | Open questions 1-3 to be resolved during implementation |
