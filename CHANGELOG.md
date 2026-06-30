# Changelog

## v0.1.5 (2026-06-30)

### Security Hardening
- **IPC Validation**: All 80+ IPC handlers validated with Zod 4 schemas (`electron/ipc/validate.ts`)
- **Shell Injection Prevention**: Changed `spawn()` from `shell:true` to `shell:false` across 5 service files
- **Secrets Management**: Discord token replaced with placeholder; `.env` files properly gitignored

### Code Quality
- **TypeScript Strict Mode**: Enabled `strict: true` with `noImplicitAny` and `strictNullChecks`
- **ESLint 9**: Flat config with 146 warnings (down from 152), 0 errors
- **Prettier**: Consistent code formatting across codebase

### Bug Fixes
- Fixed `obsidian.ts` regex escape warnings
- Fixed unused imports in `main.ts`
- Memory leak check: all event listeners lifecycle-bound, watcher cleanup verified

### Documentation
- Updated README.md with architecture overview and security features
- Created CHANGELOG.md

## v0.1.4 (2026-06-29)

### Bug Fixes
- Fixed broken require in `hermes-controller.ts`
- Fixed `pdf-parse` import in `source.ts`
- Removed debug `console.log` from NotebookPage, CurrentTimeButton, main.ts

### Improvements
- MCP types unified to `shared/types.ts`
- LibraryPage streaming cleanup with `streamingCleanupRef`
- Memory path default now uses `homedir()` instead of hardcoded path

### Code Cleanup
- Removed unused `CouncilState` interface and `calculateBordaScores`
- Fixed duplicate Tailwind color in `tailwind.config.js`
- Added `shared/**/*.ts` to knip.json project globs

## v0.1.3 (2026-06-28)

### Features
- Agent detection using shared `agent-detection.ts` (3-layer detection)
- Report path uses `homedir()` for cross-platform compatibility

### Bug Fixes
- Fixed `asar: false` in electron-builder.json
- Added 7 missing Vite externals

## v0.1.2 (2026-06-27)

### Bug Fixes
- Fixed installer corruption from v0.1.1
- Agent detection leakage: removed `agents/` from build config
- Deleted machine-specific manifests

### Features
- AgentPanel rewritten from hardcoded list to dynamic IPC
- Auto-update configured with `electron-updater`

## v0.1.1 (2026-06-26)

### Initial Release
- Fusion-Loop Brain (multi-model synthesis)
- One-click GitHub agent install
- NotebookLM-style notebook
- LLM Council (multi-model debate)
- Orchestrator with task delegation
- UMP Hub (cross-agent shared memory)
- MCP Client integration
- Discord integration
