#!/usr/bin/env bash
# Claude Code UserPromptSubmit Hook - MANDATORY Search-First Protocol
# ACTIONS FIRST, REMINDERS LAST

echo "🎯🎯🎯 SKILL CHECK - BEFORE ANY RESPONSE 🎯🎯🎯

🔒 PRIVACY GATE FOR MEMORY LOOKUPS
- Use only generic, non-identifying search keywords.
- Never send patient names, record contents, credentials, source code, or private paths.
- If the query cannot be safely sanitized, skip MCP lookup and use local workspace context.
- Never call start_session, update_session, or end_session for IntelliCare work.

⛔ NO GITHUB CLOUD CI OR PAGES - STANDING POLICY
- GitHub is source control only: normal local checks, commits, and pushes are allowed.
- Never create, restore, edit, enable, dispatch, run, or rerun GitHub Actions workflows.
- Never create or publish a GitHub Pages site.
- Never call gh or the GitHub API for status checks. Before push, verify locally that no workflow file was added or modified; after push, make no remote status queries.
- GitHub interaction is limited to ordinary git commit and git push operations.
- The PreToolUse hook hard-blocks CI/Pages creation and activation. If future work appears to require either, stop and obtain an explicit policy reversal before changing the guard.

⭐ DURABLE SIX-LESSON GATE (July 13 2026; supersedes weaker/older wording)
- DEFERRED-BLUE TEXT-QUEUE GATE (user override July 16 2026): read all currently unblue tracker A:D rows into a local-only text queue outside the repository. Do not change Excel formatting. Resume from the first queue row not marked FINISHED locally; after audit exit 0 plus exact-path commit/push, record FINISHED with commit and testing identity, then continue immediately to the next queued row. Excel blue coloring is deferred to the user and is not a prerequisite during this batch.
- TARGET LOCK: before editing, bind tracker row+prompt, collection, JSX component, PDF component, and exact real-record reference. A user target correction invalidates the whole old lock.
- TWO EVIDENCE SOURCES: run the full real record plus a non-PHI shape fixture for every changed renderer branch the real record leaves empty. Also reproduce the exact user-visible value when it differs from Mongo. Keep fixtures outside the repo.
- STANDALONE SCORE RATIOS: inventory every standalone clinical score string shaped like numerator/denominator, optionally followed by percentile or explanatory text. Route declared score fields to a custom minus/numeric-input/plus stepper that edits ONLY the numerator. Preserve the denominator, spacing, parentheses, percentile/explanatory suffix, and stored string shape exactly. Do not apply this to ratios embedded in narrative sentences or multi-number measurements such as blood pressure unless the exact field is explicitly mapped. The widget harness must classify standalone score ratios and fail when they mount a textarea.
- EDITABLE DOM CONTRACT: data-edit-field is on a wrapper CONTAINING exactly one editable row/subtitle, never on the clickable row itself; the harness uses descendant querySelector.
- GROUPING SUPERSESSION: one card per labeled group; one shared subtitle-free card per consecutive unlabeled run. Any older one-card-per-row memory is obsolete.
- PDF SELECTION: inspect the direct import AND pdf-templates/index.js, then render the selected PDF and verify 26/19/16/13/14 typography.
- COMPLETION RECEIPT: run completeTemplateAudit.mjs and require exit 0 before saying done or recording FINISHED in the local checkpoint. Prefer live Excel for the initial unblue-row snapshot; do not edit tracker formatting during this batch.
- Browser/Chrome control is surface- and session-specific; discover it in the current session before promising browser QA.

BEFORE responding to the user, check if ANY installed skill applies:
- Building/modifying UI, templates, CSS, components → Invoke: frontend-design
- Creating new features, design decisions → Invoke: brainstorming
- Debugging bugs, test failures, unexpected behavior → Invoke: systematic-debugging
- Multi-step implementation tasks → Invoke: writing-plans
- Implementing features with testable logic → Invoke: test-driven-development
- Completing major features, before merge/PR → Invoke: requesting-code-review
- 2+ independent tasks to parallelize → Invoke: dispatching-parallel-agents

⛔ If a skill applies (even 1% chance), you MUST call Skill tool BEFORE writing code!
⛔ Skills are COMPLEMENTARY to template checklist memories - use BOTH!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨🚨🚨 MANDATORY TOOL CALLS - EXECUTE NOW 🚨🚨🚨

YOUR FIRST ACTION must be these tool calls (extract keywords from user's message):

mcp__mongodb-memory__search_memories({\"query\": \"[keywords]\", \"limit\": 5})
mcp__mongodb-memory__search_sessions({\"query\": \"[keywords]\", \"limit\": 5})

FOR INTELLICARE PROJECT, ALSO EXECUTE:
mcp__mongodb-memory__recall_memories({\"project\": \"IntelliCare\", \"category\": \"standard\", \"limit\": 5})
mcp__mongodb-memory__recall_memories({\"project\": \"IntelliCare\", \"category\": \"warning\", \"limit\": 5})
mcp__mongodb-memory__recall_memories({\"project\": \"IntelliCare\", \"category\": \"pattern\", \"limit\": 5})

⛔ DO NOT write any text response before executing these searches.
⛔ DO NOT skip searches because you \"think you know the answer\".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 GATE CHECK QUESTIONS (You MUST answer BOTH in your response):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Q1: What keywords did you extract from the user's message for searching?
    Your answer → Keywords: [list 2-5 keywords]

Q2: What were the results of your search_memories and search_sessions calls?
    Your answer → Search Results: [X] memories, [Y] sessions found
                OR Exception: [reason why search not required]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 REQUIRED OUTPUT FORMAT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 GATE CHECK PASSED
Keywords: [your extracted keywords]
Search Results: [X] memories found, [Y] sessions found
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXCEPTION: Skip searches ONLY if user is asking about THIS HOOK ITSELF.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 TEMPLATE CREATION DETECTION - MANDATORY CHECKLIST LOADING 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⛔ WHEN USER MESSAGE CONTAINS ANY OF THESE PATTERNS:
   - \"create [X] template\" / \"new template\" / \"implement template\"
   - \"add template for [collection]\" / \"build template\"
   - \"[collection_name] template\" (any collection + template)
   - \"make a template\" / \"need a template\"

⛔ YOU MUST IMMEDIATELY (BEFORE writing ANY code):

1️⃣ Search for template checklist:
   mcp__mongodb-memory__search_memories({\"query\": \"template creation checklist december 2025\", \"limit\": 3})

2️⃣ Load the COMPLETE TEMPLATE CREATION CHECKLIST memory:
   Memory ID: 6929e9a15a46fb80801e0c70

3️⃣ Read the ENTIRE checklist and APPLY ALL items from the START:
   - document prop (not data)
   - 4-level search with sectionTitleMatches
   - Copy Section buttons on ALL sections
   - phrase matching (not word matching)
   - highlightText() on ALL titles/labels
   - PDF template with matching fields

4️⃣ Query MongoDB for ACTUAL DATA before designing:
   mcp__MongoDB-IntelliCare__find({\"database\": \"intellicare_practice_yale\", \"collection\": \"[collection_name]\", \"limit\": 1})

5️⃣ ALSO load the EDITING CHECKLIST memory:
   Memory ID: 69994f284953f64e15075b01
   - Approve button, saveCommaItem '. Test' handling, parsedLabelMatch
   - Single-value labeled subtitles, duplicate label suppression
   - Date picker showPicker, boolean select, number validation

6️⃣ When dispatching AGENTS for template work, ALWAYS instruct each agent to apply BOTH checklists:
   - Step 1: Fix template (creation checklist) — CSS, parseLabel, comma-split, PDF
   - Step 2: Fix editing (editing checklist) — approve, save functions, search, pickers
   - Memory ID: 69ba4ecaa7d378e6e9ffb5b9 (Agent Dispatch Rule)

⚠️ DO NOT write template code until you have:
   [ ] Loaded CREATION checklist memory 6929e9a15a46fb80801e0c70
   [ ] Loaded EDITING checklist memory 69994f284953f64e15075b01
   [ ] Read actual MongoDB document structure
   [ ] Completed PRE-ANALYSIS for each string field
   [ ] Recorded an explicit split/keep decision for every comma-bearing real value, including two-part values
   [ ] Inventoried EVERY populated scalar leaf, including bespoke objects/arrays, and mapped it to an edit widget + approve section + backend root

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 TEMPLATE PRE-ANALYSIS GATE (MANDATORY OUTPUT BEFORE ANY CODE!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⛔ YOU MUST show this analysis BEFORE writing ANY template code:

📊 PRE-ANALYSIS REPORT FOR: [collection_name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
| Field | Delimiter | Sub-Delimiter | Subtitle? | Entity Pattern? | Parser |
|-------|-----------|---------------|-----------|-----------------|--------|
| findings | semicolon | comma | YES: \"shows:\" | Tooth #X | custom |
| notes | sentence | none | NO | NO | splitBySentence |
| surgical_approach | period | comma | NO | Tooth #X | entity parser |
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Embedded Subtitles Found: [list any \"Label:\" or \"Header shows:\" patterns]
Entity Patterns Found: [Tooth #X, OD/OS, Stage X, date groups, etc.]
Copy Format Decisions: [which fields use numbered items, grouping, etc.]
Delimiter Decisions: [for EVERY comma-bearing real value: split or keep, why, and whether a field-specific COMMA_FIELDS/COMMA_ARRAY_FIELDS declaration is required]
Numeric Decisions: [for EVERY standalone numeric, number+unit, and score-ratio leaf: stepper or intentional text; for score ratios record editable numerator and immutable denominator/suffix]

⛔ TWO-PART COMMA RULE: do not use a blind `>=3` threshold after inspecting the real record. A genuine two-clause/list value with one safe top-level comma MUST split when the value's meaning or the user's exact report requires it. Preserve credentials, appositives, addresses, numeric thousands, and parenthetical commas. The declared split must render as separate editable JSX rows and mirror in Copy Section, Copy All, and PDF.

⛔ SEMICOLON-AFTER-DIGIT RULE: never apply a numeric guard to a combined `[.;]` delimiter. `(?<!\d)[.;]` incorrectly keeps `value 124; next clause` together. Split semicolons regardless of the preceding character; apply abbreviation/initial/numeric guards only to periods. Canonical flat-narrative pattern: `/(?:;\s+|(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)\.\s+)/`. Preserve delimiter-aware reconstruction and the labeled-group exception. Verify each clause independently in editable JSX, Copy Section, Copy All, and the selected PDF.

⚠️ AUTONOMOUS CHECKPOINT:
Show the pre-analysis as a concise commentary update, then continue unless a genuinely consequential user decision is missing. Do not pause merely to ask permission to implement the already-requested template work.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⛔ IF YOU SKIP THIS GATE AND WRITE CODE DIRECTLY, YOU WILL SPEND
   1+ HOUR FIXING PARSING ISSUES. THE ANALYSIS TAKES 5 MINUTES.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 DESIGN PATTERN VERIFICATION (MANDATORY BEFORE ANY JSX!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⛔ AFTER PRE-ANALYSIS, BEFORE writing ANY JSX, you MUST show this:

📐 DESIGN PATTERN VERIFICATION FOR: [template_name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
| Section Type | Required Structure | Verified? |
|--------------|-------------------|-----------|
| Metadata fields (Date, Type, Provider) | rec-mini-card + nested-subtitle + nested-mini-card value leaf (NOT meta-grid!) | [ ] |
| Array/rich-text sections (Findings, Notes, etc.) | mini-cards-container → rec-mini-card field → one nested-mini-card per labeled group and one shared nested-mini-card per consecutive unlabeled-row group | [ ] |
| Single-value sections (Assessment, Plan) | mini-cards-container → rec-mini-card → nested-mini-card → numbered-row | [ ] |
| ALL section headers | INSIDE mini-cards-container (NOT outside!) | [ ] |
| Record header | Generic \"Template Name N\"; no date/provider/facility/status pills when those values render in editable sections; grep `.date-badge` and `.record-date` aliases | [ ] |
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CSS VALUES (Copy these EXACTLY - do NOT guess!):
[ ] numbered-row background: #0d1929 (VERY DARK BLUE)
[ ] nested-subtitle color: #93c5fd (LIGHT BRIGHT BLUE)
[ ] mini-cards-container border: 2px solid rgba(96, 165, 250, 0.3)
[ ] section-header border-bottom: 1px solid rgba(96, 165, 250, 0.4)

⚠️ CHECKPOINT: \"Design patterns verified from memory 693c2551b1d38dbdcb17889d. Ready to write JSX?\"

⛔ COMMON MISTAKES TO AVOID:
   ❌ Using meta-grid for metadata fields → USE rec-mini-card + nested-subtitle
   ❌ Section title OUTSIDE mini-cards-container → PUT IT INSIDE
   ❌ Plain text-content for Assessment/Plan → WRAP IN numbered-row
   ❌ Guessing colors → COPY EXACT VALUES FROM MEMORY

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 IF TEMPLATE/CSS/PDF WORK - LOAD THESE MEMORIES FIRST:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 6929e9a15a46fb80801e0c70 - Template Checklist (6-file frontend) ⭐ LOAD FIRST!
• 692ad78e839d71706b2e39e5 - PDF Standard (Helvetica, 20/14/12pt)
• 692c719addcf19ab605c1206 - List Formatting (NUMBERS only, NO dashes)
• 69303d702ea26ad69e241fa2 - sectionTitleMatches HYBRID filtering
• 692ac733839d71706b2e39e1 - Analyze MongoDB Content FIRST
• 691b1451ea3fb8780d745d89 - sectionTitleMatches Pattern (AUTHORITATIVE)
• 693c2551b1d38dbdcb17889d - Mini-Card Pattern (blue theme)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ POST-TEMPLATE VERIFICATION CHECKLIST (BEFORE saying \"done\")
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⛔ AFTER writing template code, VERIFY these BEFORE telling user it's done:

**Component Signature:**
[ ] Uses { document } prop (NOT { data })
[ ] Has proper data unwrapping for wrapped collections

**Search Implementation:**
[ ] 4-level search: document → section → row → field
[ ] sectionTitleMatches IIFE for multi-row sections
[ ] Phrase matching (NOT word matching)
[ ] shouldShowSection for section-level filtering
[ ] _showAllSections flag for document title search

**UI Elements:**
[ ] Copy Section button on EVERY section (not just Copy per row)
[ ] highlightText() wraps ALL titles, subtitles, labels
[ ] Record header is generic; date/provider/facility/status render once in editable sections (no duplicate pills; grep `.date-badge` AND `.record-date` aliases)
[ ] Mini-card pattern with nested-subtitle (#93c5fd)
[ ] numbered-row with dark blue background (#0d1929)
[ ] EVERY value row is inside a nested-mini-card, with semantic grouping: one nested-mini-card contains the subtitle plus all rows belonging to that labeled group; consecutive unlabeled/regular rows share ONE subtitle-free nested-mini-card (never one card per unlabeled row); a rec-mini-card ancestor alone is not sufficient
[ ] Repeated dates in array sections are grouped: one editable date subtitle per unique date with all matching rows beneath it; edit stages every underlying indexed date path; Copy/PDF mirror the grouping

**Complete Editability — HARD GATE:**
[ ] Inventory EVERY populated scalar leaf from the real Mongo record, including bespoke objects, nested objects, arrays-of-objects, subtitles that currently contain values, and dynamic results
[ ] Inventory EVERY comma-bearing real value and record split/keep; every declared two-part split renders each exact clause as its own editable JSX row and its own Copy/PDF row
[ ] Inventory EVERY standalone score ratio; declared score fields edit only the numerator with a custom stepper, preserve the denominator and all suffix text literally, save the exact Mongo path, and remain whole in JSX/Copy/PDF
[ ] Every flat-narrative semicolon splits even when preceded by a digit; no splitter uses `(?<!\d)[.;]`; labeled-group exceptions preserve their original delimiter and grouping
[ ] EVERY visible '.content-value' row is an '.editable-row', unless a documented exception is shown to the user
[ ] A multi-leaf '.rec-mini-card' gives EACH leaf a stable wrapper data-edit-field=\"exact.mongo.dot.path\"; the wrapper CONTAINS exactly one editable row/subtitle (never put the attribute on the clickable row itself)
[ ] Click every visible scalar leaf and verify the expected widget mounts; the probed count must equal the visible editable scalar count — greater than zero is not sufficient
[ ] Save every nested leaf, click its section's Pending Approve, and assert the exact dot path reaches '/edit'
[ ] Every nested root is present in backend 'ALLOWED_FIELDS'; every leaf belongs to an approve section/prefix so no draft is stranded
[ ] Approved nested edits appear in JSX, Copy Section, Copy All, and PDF through arbitrary-depth immutable dot-path merging

**CSS:**
[ ] text-transform: none !important on all titles
[ ] Font hierarchy: section 19px, subtitle 17px, content 16px
[ ] Mark element: background yellow, color black

**PDF Template:**
[ ] Same field names as JSX
[ ] Same data unwrapping logic
[ ] Canonical box-free hierarchy (26 document / 19 record / 16 section / 13 label / 14 value)
[ ] Boolean wrap={false} only on atomic label+value blocks; never glue a whole record or unbounded section

**Routing (6 files total):**
[ ] AIDocumentRenderer.jsx - lazy import + TEMPLATE_PATTERNS
[ ] DocumentDetailView.jsx - AI_COLLECTIONS array
[ ] ArtifactPanel.jsx - DOCUMENT_VIEW_COLLECTIONS array
[ ] pdf-templates/index.js - no legacy or conflicting registry mapping selects a stale PDF

**Durable Completion Evidence:**
[ ] Before this target was selected: it was the first non-FINISHED row in the local-only unblue-row text queue
[ ] Target lock matches tracker row/prompt + collection + JSX + PDF + exact real-record reference
[ ] Full real record passed auditTemplate
[ ] Every modified renderer branch absent from the real record passed a non-PHI shape fixture
[ ] Exact user-visible reported value was reproduced alongside the Mongo baseline
[ ] completeTemplateAudit.mjs exited 0 and printed a completion receipt
[ ] Only then: local checkpoint row marked FINISHED with commit plus Template/Patient/Collection/Test line
[ ] Excel formatting remains unchanged; continue to the next queued row without waiting for blue coloring

⚠️ If ANY checkbox is unchecked, FIX IT before saying done!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧪 GUI TESTING INFO (ALWAYS provide after template work)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Test line: Show me [FirstName] [LastName] [Template Name]
• Collection: [collection_name]
• Patient: [FirstName] [LastName]

⛔ FINAL REPORT HARD GATE: Always include the exact Test line, Patient, and
Medical collection in every completed-template report. The Test line must use
the exact form \"Show me <Patient Name> <Template Name>\" and must never be omitted.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

════════════════════════════════════════════════════════════════
📚 REFERENCE INFORMATION (Reminders - use when relevant)
════════════════════════════════════════════════════════════════

🔧 MCP MONGODB TOOLS:
⛔ NEVER use Bash mongosh - use MCP tools instead!
• Database: intellicare_practice_yale (NOT 'IntelliCare')
• Tools: find, aggregate, count, list-collections, collection-schema

🌐 SERVER PORTS:
• Backend: http://localhost:5000
• Frontend: http://localhost:3000
• Log file: apps/backend-api/logs/server.log

🔄 AUTO-RESTART:
• Both servers run with: npm run dev
• Backend/Frontend auto-restart on code changes
⛔ NEVER tell user to restart servers

📍 HOOK FILES:
• This hook: /Users/erangross/dev/IntelliCare/claude-hooks/user-prompt-search.sh
• Topic change: /Users/erangross/dev/IntelliCare/claude-hooks/session-topic-change.sh
• Config: /Users/erangross/dev/IntelliCare/.claude/settings.local.json

📋 CHECKPOINT FILE:
<project-dir>/CHECKPOINT.md (project-specific, if used)"

exit 0
