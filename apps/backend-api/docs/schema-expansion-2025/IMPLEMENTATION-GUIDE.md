# Schema Expansion Implementation Guide

**Created:** October 22, 2025
**Location:** `apps/backend-api/docs/schema-expansion-2025/`

## Overview

This folder contains **detailed task files** for adding 18 missing medical extraction schemas to achieve 100% coverage of your PDF templates.

**Current Status:**
- ✅ **Phase 1 (Tasks 01-06):** Complete task files created - READY TO IMPLEMENT
- ✅ **Phase 2-4 (Tasks 07-18):** Summary created in PHASE-2-3-4-SUMMARY.md

**Coverage:**
- Before: 72/90 templates (80%)
- After: 90/90 templates (100%)

## Quick Start

### Step 1: Read the README
```bash
cat README.md
```
This explains the 6-step implementation process and safety rules.

### Step 2: Start with Phase 1 (Highest Priority)

**Phase 1 tasks are fully documented and ready to implement:**

1. **task-01-addiction-medicine.md** - OUD treatment tracking
2. **task-02-brain-tumor-molecular.md** - IDH/MGMT molecular markers
3. **task-03-biologic-therapy.md** - Biologics management
4. **task-04-wound-care.md** - Diabetic foot ulcers
5. **task-05-podiatry.md** - Diabetic foot screening
6. **task-06-neuropsych-enhanced.md** - Detailed cognitive testing

### Step 3: Implement ONE Task at a Time

**For each task:**

```bash
# 1. Read the task file
cat task-01-addiction-medicine.md

# 2. Backup files
cp services/claudeBatchProcessor.js services/claudeBatchProcessor.js.backup
cp services/models/collectionSchemas.js services/models/collectionSchemas.js.backup

# 3. Make changes (following task file instructions)
# - Add schema fields to claudeBatchProcessor.js
# - Register collection in medicalCollectionsService.js
# - Add collection schema to collectionSchemas.js

# 4. Syntax check
node -c services/claudeBatchProcessor.js

# 5. Test extraction
node scripts/verifyDataExtractionAutoWithCache.js --no-cache

# 6. Verify in MongoDB
MONGO_URI=$(cat .kms/MONGODB_ADMIN_URI)
mongosh "$MONGO_URI" --quiet --eval "
  db = db.getSiblingDB('intellicare_practice_yale');
  print('Count: ' + db.NEW_COLLECTION_NAME.countDocuments());
  printjson(db.NEW_COLLECTION_NAME.findOne());
"

# 7. Mark task complete, move to next
```

## Task File Structure

Each task file contains:

1. **Clinical Context** - Why this data matters
2. **Schema Code** - Exact JSON schema to add (ready to copy/paste)
3. **Line Numbers** - Where to insert in claudeBatchProcessor.js
4. **Collection Registration** - medicalCollectionsService.js changes
5. **Collection Schema** - collectionSchemas.js changes
6. **Testing Instructions** - How to verify it works
7. **Safety Checklist** - Ensure nothing breaks
8. **Success Criteria** - What "done" looks like

## Critical Safety Rules

### ⚠️ NEVER:
- Implement multiple tasks simultaneously
- Modify existing extraction functions
- Change existing collection names
- Skip syntax validation
- Skip testing after changes

### ✅ ALWAYS:
- Backup files before changes
- Implement ONE task at a time
- Test immediately after each change
- Verify MongoDB data
- Keep backups until all tasks complete

## Implementation Order

### Priority 1: Phase 1 (Tasks 01-06)
**Do these first** - highest clinical impact:
- Addiction medicine
- Brain tumor molecular
- Biologic therapy
- Wound care
- Podiatry
- Enhanced neuropsych

**Estimated time:** 1-2 days (6 tasks × 20-30 min each)

### Priority 2: Phase 2 (Tasks 07-10)
Specialized testing - moderate priority

**Estimated time:** 1 day (4 tasks)

### Priority 3: Phase 3 (Tasks 11-15)
Care coordination - important but lower urgency

**Estimated time:** 1 day (5 tasks)

### Priority 4: Phase 4 (Tasks 16-18)
Administrative/quality - lowest priority

**Estimated time:** 0.5 days (3 tasks)

**Total estimated time:** 3.5-4.5 days

## File Locations

**Schema Definitions:**
- `apps/backend-api/services/claudeBatchProcessor.js` (lines ~2680-15757)

**Collection Registry:**
- `apps/backend-api/services/medicalCollectionsService.js`

**Collection Schemas:**
- `apps/backend-api/services/models/collectionSchemas.js`

**Test PDFs:**
- `/home/erangross/Documents/English medical termplates/`

**Sample Records:**
- `apps/backend-api/sample-medical-records/`

## Troubleshooting

### Syntax Error After Adding Schema
```bash
# Restore backup
cp services/claudeBatchProcessor.js.backup services/claudeBatchProcessor.js

# Check syntax
node -c services/claudeBatchProcessor.js

# Look for common issues:
# - Missing comma after previous field
# - Unclosed bracket/brace
# - Wrong indentation
```

### Extraction Fails
```bash
# Check logs
tail -f logs/server-errors.log

# Common causes:
# - Collection not registered in medicalCollectionsService.js
# - Schema field name doesn't match collection name
# - PDF not in sample-medical-records/
```

### MongoDB Collection Not Created
```bash
# Verify collection exists
mongosh "$MONGO_URI" --eval "
  db = db.getSiblingDB('intellicare_practice_yale');
  db.getCollectionNames().filter(c => c.includes('COLLECTION_NAME'))
"

# If missing:
# 1. Re-run extraction test
# 2. Check that medicalFieldMappingService saves to this collection
# 3. Verify data was actually extracted (check extractedData in logs)
```

## Success Metrics

After completing all 18 tasks:

✅ All 90 PDF templates have extraction coverage
✅ No syntax errors in claudeBatchProcessor.js
✅ All new collections created in MongoDB
✅ Sample data extracted for each new schema
✅ Unified documents include new sections
✅ No existing schemas broken

## Next Steps After Implementation

1. **Test with Real PDFs** - Run extraction on all 90 templates
2. **Create Frontend Templates** - Build React/PDF templates for new collections
3. **Add to Artifact Panel** - Integrate new collections into UI
4. **Update Documentation** - Document new collections in CLAUDE.md
5. **Train Team** - Show clinical team new data capabilities

## Support

**Questions?**
- See main analysis: `/home/erangross/Development/IntelliCare/TEMPLATE-SCHEMA-ANALYSIS.md`
- See project memory: `/home/erangross/Development/IntelliCare/CLAUDE.md`
- Check existing schema patterns in claudeBatchProcessor.js

**Common Patterns:**
- Simple extracted fields: Just schema definition
- AI-generated fields: Schema + add to REQUIRED array (line 14789)
- Extending existing collections: Find existing field, add new properties
- New collections: Schema + registration + collection schema

## Progress Tracking

**Phase 1:** 0/6 complete
**Phase 2:** 0/4 complete
**Phase 3:** 0/5 complete
**Phase 4:** 0/3 complete

**Overall:** 0/18 complete (0%)

Update this as you complete each task!

---

**Ready to start?** Begin with `task-01-addiction-medicine.md`
