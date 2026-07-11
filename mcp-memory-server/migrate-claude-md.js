#!/usr/bin/env node
/**
 * Migrate CLAUDE.md knowledge into MCP Memory
 * This populates the MongoDB memory with all permanent reference data
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Read MongoDB URI
const MONGO_URI = fs.readFileSync(
  path.join(__dirname, '../apps/backend-api/.kms/MONGODB_ADMIN_URI'),
  'utf8'
).trim();

const DB_NAME = 'claude_memory';

// Knowledge to migrate from CLAUDE.md files
const knowledgeBase = [
  // CRITICAL BUGS AND WARNINGS
  {
    content: 'CRITICAL BUG: Emoji characters in JSON schema descriptions BREAK Claude Batch API. Symptom: Claude outputs to chat instead of executing tool. Cause: Emoji breaks JSON encoding in API requests. Fix: Use text only - "CRITICAL:", "IMPORTANT:", "WARNING:" instead of emoji. Affected: claudeBatchProcessor.js tool schema descriptions. Applies to: Any JSON schema sent to external APIs (Claude, OpenAI, etc.)',
    project: 'IntelliCare',
    tags: ['critical', 'bug', 'claude-batch-api', 'emoji', 'json-schema'],
    category: 'warning',
  },

  // DOCUMENT TEMPLATE CREATION - 6-FILE CHECKLIST
  {
    content: '6-FILE CHECKLIST for adding new collection renderers:\n1. AIDocumentRenderer.jsx - Add renderer function + routing if-statement\n2. DocumentDetailView.jsx - Add to AI_COLLECTIONS array\n3. ArtifactPanel.jsx - Add to DOCUMENT_VIEW_COLLECTIONS array\n4. routes/agent.js - Add case to generateDocumentPreview() function\n5. optimizedMedicalFunctions.js - Add to WRAP_ALL_RECORDS_COLLECTIONS Set (CRITICAL! Without this: function returns GRID view instead of DOCUMENT view)\n6. Create template files: templates/CollectionDocument.jsx + .css + PDF template',
    project: 'IntelliCare',
    tags: ['checklist', 'template-creation', 'document-renderer', 'critical'],
    category: 'standard',
  },

  // MEDICAL COLOR STANDARDS
  {
    content: 'Medical Color Standards (EXACT HEX CODES):\n- Red (#dc2626): Critical/High severity\n- Orange (#ea580c): Important/Moderate (hollow badges: transparent bg, white text, 2px border)\n- Yellow (#eab308): Low severity\n- Green (#10b981): Routine/Minor\n\nThese colors MUST be used consistently across all medical document templates.',
    project: 'IntelliCare',
    tags: ['design', 'colors', 'medical-standards', 'critical'],
    category: 'standard',
  },

  // TEMPLATE DESIGN REQUIREMENTS
  {
    content: 'CRITICAL: FOLLOW EXISTING TEMPLATE DESIGNS!\n- NEVER create templates from scratch - ALWAYS base design on existing templates\n- BEFORE implementing: Review 2-3 similar existing templates for design patterns\n\nKey templates to reference:\n- ClinicalDecisionSupportDocument.jsx - Card-based design with severity badges, colored sections\n- FollowUpIntelligenceDocument.jsx - Priority cards, two-row headers, urgency badges\n- PsychosocialAssessmentDocument.jsx - Risk color coding, narrative sections\n- VitalSignsDocument.jsx - Large readable values, status badges, clean layout',
    project: 'IntelliCare',
    tags: ['design', 'templates', 'reference', 'critical'],
    category: 'standard',
  },

  // CSS REQUIREMENTS
  {
    content: 'Template CSS Requirements:\n- Dark theme background: #343541\n- Large readable fonts: document title 32px, section title 24px, card title 22px, detail values 18px\n- Monospace font: "Courier New", "Monaco", "Menlo", "Consolas", monospace\n- Card padding: 32px\n- Search highlighting - CRITICAL SIMPLICITY: mark { background-color: #fef08a; color: #000; } DO NOT add padding, margin, positioning, !important rules, or layout properties. LESS IS MORE - Over-styling mark elements causes text shift bugs.',
    project: 'IntelliCare',
    tags: ['css', 'design', 'templates', 'critical'],
    category: 'standard',
  },

  // PDF TEMPLATE REQUIREMENTS
  {
    content: 'PDF Template Requirements (@react-pdf/renderer):\n- Font: Courier (monospace, matching web)\n- Font sizes: title 20, section 14, subsection 13, item title 12, fields 11\n- CRITICAL - Ultra-tight key:value spacing: fieldLabel: { marginRight: 0 }, fieldValue: { marginLeft: 2 }, fieldRow: { marginBottom: 0 }\n- NO BOXING: Remove all borders except section title underline\n- Tight spacing: section 14, item 8, minimal margins\n- Footer: PHI warning, page numbers',
    project: 'IntelliCare',
    tags: ['pdf', 'templates', 'design', 'critical'],
    category: 'standard',
  },

  // COPY BUTTON PATTERN
  {
    content: 'Copy Button Pattern (Prevents Layout Shift):\n- CRITICAL: Use minWidth: "85px" and justifyContent: "center" to prevent layout shift when text changes from "Copy" to "Copied!"\n- Use flexShrink: 0\n- Button shows "Copy" by default, changes to "Copied!" on click\n- Inline hover styles: background changes from transparent to #40414f, color from #9ca3af to #ececf1',
    project: 'IntelliCare',
    tags: ['copy-button', 'layout-shift', 'design', 'critical'],
    category: 'pattern',
  },

  // SEARCH IMPLEMENTATION
  {
    content: 'Search Implementation Pattern:\n- Build searchable array with ALL items, add _type and _searchText fields\n- Use useDocumentSearch hook with fields to search\n- Filter by type after search\n- CRITICAL: Only render section if it has filtered items OR no search\n- CRITICAL: Hide static cards when searching using {!searchTerm && data.staticField && (<div>...</div>)}',
    project: 'IntelliCare',
    tags: ['search', 'templates', 'pattern', 'critical'],
    category: 'pattern',
  },

  // CLIPBOARD COPY - PREVENTING LAYOUT SHIFTS
  {
    content: 'Clipboard Copy - Preventing Layout Shifts:\nRoot Cause: CSS, NOT JavaScript! Most layout shifts are caused by CSS styling, not the clipboard API.\n\nCommon Causes:\n1. min-height: 100vh on artifact containers - REMOVE IT!\n2. Button width changes when text changes ("Copy All" → "✓ Copied All")\n3. Hover transforms (e.g., transform: translateY(-2px))\n4. Appending to document.body with position: fixed\n\nPrevention:\n1. Remove min-height: 100vh from document containers\n2. Fixed button widths: min-width: 120px + text-align: center\n3. Use component containerRef instead of document.body\n4. Position: absolute with left: -9999px (not fixed)',
    project: 'IntelliCare',
    tags: ['clipboard', 'layout-shift', 'bug-prevention', 'critical'],
    category: 'pattern',
  },

  // DOCUMENT ANALYSIS FUNCTIONS
  {
    content: 'Document Analysis Functions - CRITICAL naming to prevent AI confusion:\n- previewPendingDocument = metadata only (filename, size, type)\n- processUploadedDocuments = actual AI analysis via Claude Batch API\n- When user says "analyze", use processUploadedDocuments, NOT preview!\n- Function Registry: All functions defined in apps/backend-api/services/utils/aiHelpers.js\n- Method: getAllPlatformFunctions() (lines ~1000-8500, ~1400 total functions)\n- To modify functions visible to Claude: Edit aiHelpers.js hardcoded section (lines 1000-1300)',
    project: 'IntelliCare',
    tags: ['document-analysis', 'functions', 'ai-helpers', 'critical'],
    category: 'reference',
  },

  // ARTIFACT PANEL SYSTEM
  {
    content: 'Artifact Panel System (October 2025) - Claude.ai style split-screen medical data viewer:\n- Replaces inline grids with dedicated 50/50 split-screen interface\n- 3-level navigation: categories → documents → detail\n- State persistence via localStorage\n- Message input positioning (fixed at bottom with 30px margin, adjusts for artifact and sidebars)\n- Event-based communication between components',
    project: 'IntelliCare',
    tags: ['artifact-panel', 'architecture', 'ui-system'],
    category: 'architecture',
  },

  // MONGODB CONFIGURATION
  {
    content: 'MongoDB Configuration:\n- Version: mongosh 2.5.8\n- Credentials: apps/backend-api/.kms/MONGODB_ADMIN_URI (600 permissions)\n- Working Database: intellicare_practice_yale (development)\n- Medical Collections: 33 with data (233 total documents)\n- Top collections: riskfactors (66), imagingreports (29), medication_optimization (17)',
    project: 'IntelliCare',
    tags: ['mongodb', 'database', 'configuration'],
    category: 'reference',
  },

  // WRAP_ALL_RECORDS_COLLECTIONS
  {
    content: 'WRAP_ALL_RECORDS_COLLECTIONS in optimizedMedicalFunctions.js:\nCRITICAL: Adding collection to this Set changes data structure from GRID to DOCUMENT view.\n- Without: Function returns [{...}, {...}] (array of records)\n- With: Function returns { collection_name: [{...}, {...}] } (wrapped object)\n- Template must unwrap: const data = rawData.collection_name?.[0] || rawData;\n- MOST COMMON MISTAKE: Forgetting to add to WRAP_ALL_RECORDS_COLLECTIONS causes template to receive wrong data structure',
    project: 'IntelliCare',
    tags: ['wrap-records', 'critical', 'common-mistake', 'grid-vs-document'],
    category: 'warning',
  },

  // COMMON MISTAKES
  {
    content: 'Common Template Creation Mistakes:\n❌ Forgetting to add to WRAP_ALL_RECORDS_COLLECTIONS (shows grid instead of document)\n❌ Not hiding static cards during search (cards show even with no matches)\n❌ Not using minWidth: 85px on copy buttons (causes layout shift)\n❌ Wrong spacing in PDF (keys too far from values)\n❌ Using Helvetica instead of Courier in PDF\n❌ Not sorting items by severity/urgency\n❌ Over-styling mark elements for search highlighting (causes text shift)',
    project: 'IntelliCare',
    tags: ['common-mistakes', 'templates', 'critical'],
    category: 'warning',
  },
];

async function migrate() {
  console.log('🔄 Starting migration of CLAUDE.md knowledge to MCP Memory...\n');

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection('memories');

    // Clear existing standard/reference memories to avoid duplicates
    console.log('🗑️  Clearing old standard/reference memories...');
    const deleteResult = await collection.deleteMany({
      category: { $in: ['standard', 'pattern', 'warning', 'reference', 'architecture'] }
    });
    console.log(`   Deleted ${deleteResult.deletedCount} old entries\n`);

    // Insert new knowledge base
    console.log('📝 Inserting knowledge base...');
    for (const item of knowledgeBase) {
      const memory = {
        ...item,
        timestamp: new Date(),
      };

      const result = await collection.insertOne(memory);
      console.log(`   ✅ ${item.category.toUpperCase()}: ${item.content.substring(0, 60)}...`);
      console.log(`      ID: ${result.insertedId}, Tags: [${item.tags.join(', ')}]\n`);
    }

    console.log(`\n✅ Migration complete! Inserted ${knowledgeBase.length} knowledge entries.`);

    // Show summary
    console.log('\n📊 Memory Summary by Category:');
    const pipeline = [
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ];
    const summary = await collection.aggregate(pipeline).toArray();
    summary.forEach(s => console.log(`   ${s._id}: ${s.count}`));

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

migrate();
