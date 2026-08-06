# Primary Workflow

**IMPORTANT:** Analyze the skills catalog and activate the skills that are needed for the task during the process.
**IMPORTANT**: Ensure token efficiency while maintaining high quality.

#### 1. Code Implementation
- Before you start, delegate to `apw:planner` agent to create a implementation plan with TODO tasks in `./plans` directory.
- When in planning phase, use multiple `researcher` agents in parallel to conduct research on different relevant technical topics and report back to `apw:planner` agent to create implementation plan.
- Write clean, readable, and maintainable code
- Follow established architectural patterns
- Implement features according to specifications
- Handle edge cases and error scenarios
- **DO NOT** create new enhanced files, update to the existing files directly.
- **[IMPORTANT]** After creating or modifying code file, run compile command/script to check for any compile errors.

#### 2. Testing
- Delegate to `apw:tester` agent to run tests on the **simplified code**
  - Write comprehensive unit tests
  - Ensure high code coverage
  - Test error scenarios
  - Validate performance requirements
- Tests verify the FINAL code that will be reviewed and merged
- **DO NOT** ignore failing tests just to pass the build.
- **IMPORTANT:** make sure you don't use fake data, mocks, cheats, tricks, temporary solutions, just to pass the build or github actions.
- **IMPORTANT:** Always fix failing tests follow the recommendations and delegate to `apw:tester` agent to run tests again, only finish your session when all tests pass.

#### 3. Code Quality
- After testing passes, delegate to `apw:code-reviewer` agent to review clean, tested code.
- Follow coding standards and conventions
- Write self-documenting code
- Add meaningful comments for complex logic
- Optimize for performance and maintainability

#### 4. Integration
- Always follow the plan given by `apw:planner` agent
- Ensure seamless integration with existing code
- Follow API contracts precisely
- Maintain backward compatibility
- Document breaking changes
- Delegate to `apw:docs-manager` agent to update docs in `./docs` directory if any.

#### 5. Debugging
- When a user report bugs or issues on the server or a CI/CD pipeline, delegate to `apw:debugger` agent to run tests and analyze the summary report.
- Read the summary report from `apw:debugger` agent and implement the fix.
- Delegate to `apw:tester` agent to run tests and analyze the summary report.
- If the `apw:tester` agent reports failed tests, fix them follow the recommendations and repeat from the **Step 3**.

#### 6. Visual Explanations
When explaining complex code, protocols, or architecture:
- **When to use:** User asks "explain", "how does X work", "visualize", or topic has 3+ interacting components
- Use `/apw:preview --explain <topic>` to generate visual explanation with ASCII + Mermaid
- Use `/apw:preview --diagram <topic>` for architecture and data flow diagrams
- Use `/apw:preview --slides <topic>` for step-by-step walkthroughs
- Use `/apw:preview --ascii <topic>` for terminal-friendly output only
- **HTML mode** (add `--html` for self-contained HTML pages, opens directly in browser):
  - `/apw:preview --html --explain <topic>` — publication-quality HTML explanation
  - `/apw:preview --html --diagram <topic>` — interactive HTML diagram with zoom controls
  - `/apw:preview --html --slides <topic>` — magazine-quality slide deck
  - `/apw:preview --html --diff [ref]` — visual diff review
  - `/apw:preview --html --plan-review` — plan vs codebase comparison
  - `/apw:preview --html --recap [timeframe]` — project context snapshot
- **Plan context:** Visuals save to plan folder from `## Plan Context` hook injection; if none, uses `plans/visuals/`
- **Markdown mode:** Auto-opens in browser via markdown-novel-viewer with Mermaid rendering
- **HTML mode:** Opens directly in browser — self-contained, no server needed
- See `development-rules.md` → "Visual Aids" section for additional guidance
