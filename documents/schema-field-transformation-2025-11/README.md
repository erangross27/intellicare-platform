# Schema Field Transformation Project
**Created:** November 10, 2025
**Status:** Active
**Goal:** Transform 330 collections from generic template fields to medical-specific field schemas

---

## 📊 Project Overview

### Current State
- **Total collections in schema:** 752
- **Collections with ONLY generic fields:** 330 (44%)
- **Collections with system prompts:** 35
- **Collections missing prompts:** 717

### Generic Field Template (11 fields)
The following 11 generic fields were auto-generated for collections without schemas:
```
date, type, provider, facility, findings, assessment, plan,
recommendations, results, notes, status
```

### Problem
Generic fields provide **baseline extraction capability** but result in:
- ❌ Low field completion (20-30% instead of >80%)
- ❌ Non-specific data capture (everything goes into "findings" or "notes")
- ❌ Missed medical-specific details (no fields for specialty-specific data)
- ❌ Poor system prompt guidance (can't write specific extraction rules)

### Solution
Transform each collection to have **medical-specific fields** that match the clinical domain:

**Example Transformation:**
```javascript
// BEFORE (generic):
surgical_steps: {
  date, type, provider, facility, findings, assessment, plan, ...
}

// AFTER (medical-specific):
surgical_steps: {
  procedureName, stepNumber, stepDescription, surgeon,
  assistants, instrumentsUsed, technique, duration,
  specimens, complications, anesthesiaType, ...
}
```

---

## 🎯 Project Goals

1. ✅ **Create organized project structure** with task tracking
2. 🔄 **Transform 330 collections** from generic to medical-specific fields
3. ✅ **Verify Phase 2 selective loading** (only loads prompts for selected collections)
4. 📝 **Generate system prompts** after schema transformation
5. 🔗 **Maintain alignment** between schema fields and database fields

---

## 📁 Project Structure

```
documents/schema-field-transformation-2025-11/
├── README.md                                    (this file)
├── 00-COMPLETE-LIST-330-collections.json        (all 330 collections)
├── PROGRESS-TRACKER.md                          (checkpoint system)
├── tasks/
│   ├── 01-surgical-collections.md               (50-60 collections)
│   ├── 02-imaging-radiology-collections.md      (40-50 collections)
│   ├── 03-laboratory-collections.md             (30-40 collections)
│   ├── 04-obstetrics-gynecology-collections.md  (20-30 collections)
│   ├── 05-oncology-collections.md               (20-30 collections)
│   ├── 06-cardiology-collections.md             (15-25 collections)
│   ├── 07-neurology-collections.md              (15-25 collections)
│   ├── 08-specialty-collections.md              (40-50 collections)
│   └── 09-administrative-collections.md         (20-30 collections)
└── completed/
    └── [collection-name].json                   (transformation records)
```

---

## 🔄 Two-Pass Batch Extraction System

### Phase 1: Collection Selection (claudeBatchProcessorPhase1.js)
- Builds 752 **lightweight descriptors** (name, description, field count)
- Claude selects **15-50 relevant collections** for the document
- Token cost: ~50K tokens
- Output: Array of selected collection names

### Phase 2: Targeted Extraction (claudeBatchProcessorPhase2.js)
- Builds **ONLY tools for selected collections** (15-50 tools, not 752)
- Loads **ONLY prompts for selected collections** via `loadCollectionPrompts()`
- Token cost: ~150K tokens
- **✅ VERIFIED:** Phase 2 does NOT load all 35 prompts - only loads prompts for collections in `selectedCollections` array

**Code Evidence (claudeBatchProcessorPhase2.js:140-143):**
```javascript
createPhase2SystemPrompt(selectedCollections) {
  const collectionGuidance = selectedCollections
    .map(collection => this.generateCollectionPrompt(collection))  // Only selected!
    .join('\n\n');
```

---

## 📋 Workflow

### For Each Collection:

1. **Analyze Medical Domain**
   - What specialty does this collection belong to?
   - What specific data points do clinicians document?
   - What fields would Claude need to extract comprehensive data?

2. **Design Field Schema**
   - Replace 11 generic fields with 15-40 medical-specific fields
   - Group fields logically (measurements, findings, medications, etc.)
   - Use descriptive field names that match medical terminology

3. **Update unified-medical-schemas.json**
   - Add all new fields with proper metadata:
     ```json
     {
       "type": "string|number|Date|array|object",
       "description": "Clear description for Claude",
       "required": false,
       "extractable": true,
       "storable": true,
       "source": "batch",
       "agentVisible": true
     }
     ```

4. **Create Backup**
   - Backup unified-medical-schemas.json before each change
   - Track transformation in completed/ folder

5. **Verify & Test**
   - Ensure schema loads without errors
   - Check field count increased appropriately
   - Ready for system prompt creation

---

## 🎓 Reference: Successful Transformation Example

**Memory ID:** 6910996675d21ba53b5a3da4
**Collection:** diabetes_management_notes
**Transformation:** 11 generic fields → 35 diabetes-specific fields

**New Field Categories:**
- Glycemic Metrics: hba1c, glucoseLevel, glucoseRange, timeInRange
- Classification: diabetesType, controlStatus
- Medications: insulinRegimen, oralMedications, otherMedications, medicationChanges
- Monitoring: selfMonitoring, medicationAdherence
- Complications: neuropathyStatus, retinopathyStatus, nephropathyStatus, footExam
- Lifestyle: dietAdherence, exercisePattern, diabetesEducation
- Safety: hypoglycemicEvents
- Vitals: weight, bmi, bloodPressure
- Goals: goals array, followUp

**Result:** Field completion improved from 20-30% → >80%

---

## ⚠️ Critical Rules

1. **Never alter schema without backup** (Memory ID 690e181f3a48e8e2cb6d542f)
2. **Use ONLY field names from schema** - no invented fields (Memory ID 690a18ea3254579d1e2a6845)
3. **Maintain extractable/storable flags** consistently
4. **Test after each phase** - don't batch up changes
5. **Document transformations** in completed/ folder

---

## 📊 Success Metrics

- **Field count:** 11 generic → 15-40 medical-specific (avg 30)
- **Field completion:** 20-30% → >80% with comprehensive prompts
- **Token efficiency:** Phase 2 loads only selected prompts (not all 35)
- **Data quality:** Specific medical fields replace vague "findings" catch-all

---

## 🚀 Next Steps

1. ✅ Create task files categorized by medical specialty
2. 🔄 Identify which collections are frequently selected by Phase 1
3. 🔄 Prioritize transformation based on selection frequency
4. 📝 Transform high-priority collections first
5. 📝 Generate comprehensive system prompts for transformed collections

---

**Last Updated:** November 10, 2025
**Session ID:** 0134af58-1bb4-41ea-bed7-db5436a74992
