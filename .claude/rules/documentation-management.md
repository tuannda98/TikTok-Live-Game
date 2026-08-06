# Project Documentation Management

### Project Documentation Files

The `docs/` directory contains the following files — always read before modifying related code:

- **Backend** (`./docs/BACKEND_DEVELOPMENT.md`): Provider system internals, TikTokService, adding new providers
- **Development** (`./docs/DEVELOPMENT.md`): Dev environment setup, project structure, coding conventions
- **Game Development** (`./docs/GAME_DEVELOPMENT.md`): How to create new games, Bridge SDK client usage, event wiring
- **Gift Catalog** (`./docs/GIFT_CATALOG.md`): TikTok gift list by coin price (used for game tier config)
- **Operations** (`./docs/OPERATIONS.md`): Deployment, OBS overlay setup, monitoring, troubleshooting

### Documentation Update Triggers

Update relevant docs when:
- Adding a new game → update `GAME_DEVELOPMENT.md` with any new patterns or Bridge SDK usage
- Adding/modifying a TikTok provider → update `BACKEND_DEVELOPMENT.md`
- Changing deployment or OBS setup → update `OPERATIONS.md`
- Adding new gift tiers → update `GIFT_CATALOG.md`
- Changing dev setup, conventions, or project structure → update `DEVELOPMENT.md`

### Update Protocol
1. **Before Updates**: Read the relevant doc file first to understand current state
2. **During Updates**: Keep docs accurate and concise — no stale references
3. **After Updates**: Verify code examples in docs still match actual implementation

### Plans

### Plan Location
Save plans in `./plans` directory with timestamp and descriptive name.

**Format:** Use naming pattern from `## Naming` section injected by hooks.

**Example:** `plans/251101-1505-authentication-and-profile-implementation/`

#### File Organization

```
plans/
├── 20251101-1505-authentication-and-profile-implementation/
    ├── research/
    │   ├── researcher-XX-report.md
    │   └── ...
│   ├── reports/
│   │   ├── scout-report.md
│   │   ├── researcher-report.md
│   │   └── ...
│   ├── plan.md                                # Overview access point
│   ├── phase-01-setup-environment.md          # Setup environment
│   ├── phase-02-implement-database.md         # Database models
│   ├── phase-03-implement-api-endpoints.md    # API endpoints
│   ├── phase-04-implement-ui-components.md    # UI components
│   ├── phase-05-implement-authentication.md   # Auth & authorization
│   ├── phase-06-implement-profile.md          # Profile page
│   └── phase-07-write-tests.md                # Tests
└── ...
```

#### File Structure

##### Overview Plan (plan.md)
- Keep generic and under 80 lines
- List each phase with status/progress
- Link to detailed phase files
- Key dependencies

##### Phase Files (phase-XX-name.md)
Each phase file should contain:

**Context Links**
- Links to related reports, files, documentation

**Overview**
- Priority
- Current status
- Brief description

**Key Insights**
- Important findings from research
- Critical considerations

**Requirements**
- Functional requirements
- Non-functional requirements

**Architecture**
- System design
- Component interactions
- Data flow

**Related Code Files**
- List of files to modify
- List of files to create
- List of files to delete

**Implementation Steps**
- Detailed, numbered steps
- Specific instructions

**Todo List**
- Checkbox list for tracking

**Success Criteria**
- Definition of done
- Validation methods

**Risk Assessment**
- Potential issues
- Mitigation strategies

**Security Considerations**
- Auth/authorization
- Data protection

**Next Steps**
- Dependencies
- Follow-up tasks