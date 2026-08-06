---
name: apw:bootstrap
description: "Bootstrap new projects with research, tech stack, design, planning, and implementation. Modes: full (default interactive), auto (explicit autonomous), fast (skip research), parallel (multi-agent)."
user-invocable: true
when_to_use: "Invoke to start a new project or full-stack setup from scratch."
category: utilities
keywords: [scaffold, project, setup, boilerplate]
license: MIT
argument-hint: "[requirements] [--full|--auto|--fast|--parallel]"
---

# Bootstrap - New Project Scaffolding

End-to-end project bootstrapping from idea to running code.

**Principles:** YAGNI, KISS, DRY | Token efficiency | Concise reports

## Usage

```
/apw:bootstrap <user-requirements>
```

**Flags** (optional, default `--full`):

| Flag | Mode | Thinking | User Gates | Planning Skill | Code Skill |
|------|------|----------|------------|----------------|------------|
| `--full` | Full interactive | Ultrathink | Every phase | `--hard` | `--interactive` |
| `--auto` | Automatic explicit opt-in | Ultrathink | Design only | `--auto` | `--auto` |
| `--fast` | Quick | Think hard | Code review gates | `--fast` | `--fast` |
| `--parallel` | Multi-agent | Ultrathink | Design only | `--parallel` | `--parallel` |

**Example:**
```
/apw:bootstrap "Build a SaaS dashboard with auth" --fast
/apw:bootstrap "E-commerce platform with Stripe" --parallel
```

## Workflow Overview

```
[Git Init] → [Research?] → [Tech Stack?] → [Design?] → [Planning] → [Implementation] → [Test] → [Review] → [Docs] → [Onboard] → [Final]
```

Each mode loads a specific workflow reference + shared phases.

## Mode Detection

If no flag provided, default to `--full`.

Load the appropriate workflow reference:
- `--full`: Load `references/workflow-full.md`
- `--auto`: Load `references/workflow-auto.md` only when explicitly requested
- `--fast`: Load `references/workflow-fast.md`
- `--parallel`: Load `references/workflow-parallel.md`

All modes share: Load `references/shared-phases.md` for implementation through final report.

## Step 0: Git Init (ALL modes)

Check if Git initialized. If not:
- `--full`: Ask user if they want to init → `apw:git-manager` subagent (`main` branch)
- Others: Auto-init via `apw:git-manager` subagent (`main` branch)

## Skill Triggers (MANDATORY)

After early phases (research, tech stack, design), trigger downstream skills:

### Planning Phase
Activate **apw:plan** skill with mode-appropriate flag:
- `--full` → `/apw:plan --hard <requirements>` (thorough research + validation)
- `--auto` → `/apw:plan --auto <requirements>` (auto-detect complexity)
- `--fast` → `/apw:plan --fast <requirements>` (skip research)
- `--parallel` → `/apw:plan --parallel <requirements>` (file ownership + dependency graph)

Planning skill outputs a plan path. Pass this to code.

### Implementation Phase
Activate **apw:code** skill with the plan path and mode-appropriate flag:
- `--full` → `/apw:code <plan-path>` (interactive review gates)
- `--auto` → `/apw:code --auto <plan-path>` (explicit autonomous implementation)
- `--fast` → `/apw:code --fast <plan-path>` (skip extra research, keep review gates)
- `--parallel` → `/apw:code --parallel <plan-path>` (multi-agent execution)

## Role

Elite software engineering expert specializing in system architecture and technical decisions. Brutally honest about feasibility and trade-offs.

## Critical Rules

- Activate relevant skills from catalog during the process
- Keep all research reports ≤150 lines
- All docs written to `./docs` directory
- Plans written to `./plans` directory using naming from `## Naming` section
- DO NOT implement code directly — delegate through planning + code skills
- Sacrifice grammar for concision in reports
- List unresolved questions at end of reports
- Run `/apw:journal` to write a concise technical journal entry upon completion

## References

- `references/workflow-full.md` - Full interactive workflow
- `references/workflow-auto.md` - Explicit auto workflow
- `references/workflow-fast.md` - Fast workflow
- `references/workflow-parallel.md` - Parallel workflow
- `references/shared-phases.md` - Common phases (implementation → final report)
