#!/usr/bin/env bash
# Claude Code UserPromptSubmit Hook - MANDATORY Search-First Protocol
# ACTIONS FIRST, REMINDERS LAST

echo "🎯🎯🎯 SKILL CHECK - BEFORE ANY RESPONSE 🎯🎯🎯

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
   [ ] Loaded CREATION checklist memory 6982205e03e7615e84c02496
   [ ] Loaded EDITING checklist memory 69994f284953f64e15075b01
   [ ] Read actual MongoDB document structure
   [ ] Completed PRE-ANALYSIS for each string field

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

⚠️ USER APPROVAL CHECKPOINT:
\"Here is my pre-analysis. Ready to proceed with template code?\"

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
| Metadata fields (Date, Type, Provider) | rec-mini-card + nested-subtitle (NOT meta-grid!) | [ ] |
| Array sections (Findings, Notes, etc.) | mini-cards-container → numbered-row | [ ] |
| Single-value sections (Assessment, Plan) | mini-cards-container → numbered-row | [ ] |
| ALL section headers | INSIDE mini-cards-container (NOT outside!) | [ ] |
| Record header | date-badge (left) + status-badge (right) in header-top-row | [ ] |
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
[ ] Header has date badge top-right, title below
[ ] Mini-card pattern with nested-subtitle (#93c5fd)
[ ] numbered-row with dark blue background (#0d1929)

**CSS:**
[ ] text-transform: none !important on all titles
[ ] Font hierarchy: section 19px, subtitle 17px, content 16px
[ ] Mark element: background yellow, color black

**PDF Template:**
[ ] Same field names as JSX
[ ] Same data unwrapping logic
[ ] Helvetica font, 12pt content
[ ] wrap={false} patterns appropriate for content size

**Routing (6 files total):**
[ ] AIDocumentRenderer.jsx - lazy import + TEMPLATE_PATTERNS
[ ] DocumentDetailView.jsx - AI_COLLECTIONS array
[ ] ArtifactPanel.jsx - DOCUMENT_VIEW_COLLECTIONS array

⚠️ If ANY checkbox is unchecked, FIX IT before saying done!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧪 GUI TESTING INFO (ALWAYS provide after template work)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Collection: [collection_name]
• Patient: [FirstName] [LastName]
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
