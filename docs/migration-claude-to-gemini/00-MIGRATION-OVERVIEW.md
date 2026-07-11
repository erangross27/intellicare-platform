# Migration Plan: Claude to Gemini 3.0 (CANCELLED)

**STATUS:** **DO NOT MIGRATE** - See [08-MIGRATION-BLOCKERS.md](./08-MIGRATION-BLOCKERS.md) for technical reasoning.

**Objective:** (Previously) Migrate the IntelliCare backend from Anthropic Claude to Google Gemini (3.0 Pro/Flash).

**Scope:** This is a major architectural refactor. The current system is tightly coupled to Anthropic's specific features (Batch API, Prompt Caching, and custom "Two-Stage" function selectors).

**Estimated Effort:** 30-40 Hours (Full Feature Parity - DEEMED UNFEASIBLE for toolset size)

## Migration Strategy (Archive)

The following phased approach was planned but is currently **blocked** by Gemini's limit of 128 tools vs IntelliCare's 3,500+ tools.

1.  **Phase 1: Infrastructure & Core Chat (Fast Path)**
2.  **Phase 2: Advanced Logic & Tooling**
3.  **Phase 3: Batch Processing & Optimization**

## Task Breakdown

| Task ID | Description | File |
| :--- | :--- | :--- |
| **01** | **Infrastructure Setup** | [01-SETUP-INFRASTRUCTURE.md](./01-SETUP-INFRASTRUCTURE.md) |
| **02** | **Core Agent Service** | [02-CORE-AGENT-SERVICE.md](./02-CORE-AGENT-SERVICE.md) |
| **03** | **Function Calling & Tools** | [03-FUNCTION-CALLING-ADAPTATION.md](./03-FUNCTION-CALLING-ADAPTATION.md) |
| **04** | **Batch Processing** | [04-BATCH-PROCESSOR.md](./04-BATCH-PROCESSOR.md) |
| **05** | **Prompt Engineering & Caching** | [05-PROMPT-ENGINEERING.md](./05-PROMPT-ENGINEERING.md) |
| **06** | **Testing & Validation** | [06-TESTING-AND-VALIDATION.md](./06-TESTING-AND-VALIDATION.md) |
| **08** | **Critical Blockers** | [08-MIGRATION-BLOCKERS.md](./08-MIGRATION-BLOCKERS.md) |
