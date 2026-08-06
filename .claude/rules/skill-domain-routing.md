# Skill Domain Routing

When a user's task involves a specific domain, use these decision trees to pick the RIGHT skill based on user intent.

Only skills that actually exist in `.claude/skills/` are listed here. For broader catalog needs, check `.claude/skills/` directly.

## Backend / Server (Node.js 18+ ESM + Express 4 + Socket.io 4)

```
User wants to...
├── Write or refactor Node.js/Express/Socket.io code → /apw:javascript-pro (or javascript-pro catalog skill)
├── Debug server errors, Socket.io events, providers → /apw:debug
├── Look up Express, Socket.io, TikTok connector docs → /apw:docs-seeker
└── Design API routes, Socket event schema            → /apw:plan then /apw:code
```

Key files: `src/server.js`, `src/services/`, `src/services/providers/`

## Game Development (Vanilla JS + Canvas 2D — OBS Overlays)

```
User wants to...
├── Build or modify a game overlay                  → /apw:code (JavaScript + Canvas)
├── Style game overlays (transparent OBS bg)        → /apw:ui-styling
├── Test a game visually in the browser             → /apw:agent-browser
└── Create a new game from scratch                  → /apw:plan then /apw:code
```

Key files: `public/games/{game-name}/index.html`, `game.js`, `race-engine.js`, `config.js`, `style.css`
Reference: `docs/GAME_DEVELOPMENT.md`

## Dashboard / Frontend (Vanilla HTML/CSS/JS)

```
User wants to...
├── Update dashboard UI or URL generator            → /apw:code (Vanilla JS/HTML/CSS)
├── Style layout, responsive design                 → /apw:ui-styling
└── Debug TikTok Bridge client SDK                  → /apw:debug
```

Key files: `public/index.html`, `public/js/dashboard.js`, `public/lib/tiktok-bridge.js`, `public/css/styles.css`

## TikTok Integration (Provider System)

```
User wants to...
├── Add or modify a TikTok provider                 → /apw:code + /apw:docs-seeker
├── Debug live connection / event flow              → /apw:debug + /apw:sequential-thinking
└── Understand provider architecture                → /apw:scout
```

Key files: `src/services/providers/`, `docs/BACKEND_DEVELOPMENT.md`

## Codebase Understanding

```
User wants to...
├── Quick file search, locate specific code         → /apw:scout
└── Onboard a new repo / dump codebase for LLM     → /apw:repomix
```

## AI / LLM

```
User wants to...
└── Generate/analyze images, audio, video with AI  → /apw:ai-multimodal
```

## MCP (Model Context Protocol)

```
User wants to...
└── Discover and execute MCP tools                  → /apw:use-mcp
```

## Testing / Browser

```
User wants to...
├── Run test suites, coverage reports, TDD          → /apw:test
└── Drive a live browser (verify overlays, UI)      → /apw:agent-browser
```

## Documentation

```
User wants to...
├── Update project docs in docs/                    → /apw:docs
└── Search library/framework docs (context7)        → /apw:docs-seeker
```

## Usage Notes

- Pick ONE skill per distinct user intent
- If a task spans two domains (e.g. "build + test"), suggest the primary skill and mention the secondary
- Domain skills combine with core workflow: `/apw:plan` → domain skill → `/apw:code`
- Utility skills activated on demand: `/apw:ask`, `/apw:preview`, `/apw:sequential-thinking`, `/apw:brainstorm`, `/apw:research`, `/apw:journal`, `/apw:project-management`, `/apw:project-organization`, `/apw:team`
- See `skill-workflow-routing.md` for multi-step workflow sequences
