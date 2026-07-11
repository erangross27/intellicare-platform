When adding new medical fields, always follow the 4-step checklist in CLAUDE.md:
  1. Add schema in claudeBatchProcessor.js
  2. Add handler in agentServiceV4.saveExtractedDocumentData()
  3. Register collection in medicalCollectionsService.js
  4. Add mapping in verification script
