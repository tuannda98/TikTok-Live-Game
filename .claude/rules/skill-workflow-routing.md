# Skill Workflow Routing

When orchestrating multi-step tasks, consider these workflow sequences. Skills are listed in typical execution order.

## New Project Bootstrap Workflow

```
/apw:bootstrap → (research → tech stack → design → /apw:plan → /apw:code → /apw:test → /apw:code-review → /apw:journal)
```

| User Intent | Suggested Start |
|-------------|----------------|
| "bootstrap project", "scaffold from scratch", "new project" | `/apw:bootstrap` (default `--full`) |
| "bootstrap fast", "quick scaffold" | `/apw:bootstrap --fast` |
| "autonomous scaffold" | `/apw:bootstrap --auto` |
| "parallel scaffold", "multi-agent bootstrap" | `/apw:bootstrap --parallel` |

## Core Development Workflow

```
/apw:plan → /apw:code → /apw:test → /apw:code-review → /apw:journal
```

| User Intent | Suggested Start |
|-------------|----------------|
| "implement feature X", "build X", "add X" | `/apw:plan` then `/apw:code` |
| "execute this plan" | `/apw:code <plan-path>` |

## Bugfix Workflow

```
/apw:scout → /apw:debug → /apw:fix-bug → /apw:test → /apw:code-review
```

| User Intent | Suggested Start |
|-------------|----------------|
| "X is broken", "error in X", "bug in X" | `/apw:fix-bug` (auto-scouts internally) |
| "CI is failing", "tests broken" | `/apw:fix-bug --auto` |
| "investigate why X happens" | `/apw:scout` then `/apw:debug` |

## Investigation Workflow

```
/apw:scout → /apw:debug → /apw:brainstorm → /apw:plan
```

| User Intent | Suggested Start |
|-------------|----------------|
| "understand how X works" | `/apw:scout` |
| "why is X happening" | `/apw:debug` |
| "explore options for X" | `/apw:brainstorm` then `/apw:plan` |

## Post-Implementation Checklist

After completing implementation work, consider:
- `/apw:code-review` — review changes before merging
- `/apw:test` — run full test suite
- `/apw:journal` — document decisions and lessons learned

## Setup Skills

Before starting implementation in a shared codebase:
- `/apw:scout` — discover relevant files and code patterns
- `/apw:research` — research technical solutions before implementation
