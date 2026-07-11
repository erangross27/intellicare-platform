# Template Editing System Design

**Date:** 2026-02-20
**Status:** Approved
**Scope:** Add per-sentence editing, approval, and per-collection backend isolation to all 622 artifact templates

---

## 1. Problem

Only `PatientVisitDocument` currently supports inline editing (per-sentence edit, edited/added badges, approve flow). All other 621 templates are read-only. The goal is to bring the same editing capability to every template with:

- **Per-template self-contained code** — NO shared hooks, NO shared CSS, NO shared utilities between templates
- **Per-collection backend routes** — separate route file per collection for HIPAA-compliant isolation
- **Per-template permission sets** — different roles can read/write different templates (e.g., nurses read-only, doctors read+write)

---

## 2. Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Frontend code sharing | **None** — each template self-contained | User requirement: "No shared anything" |
| Backend route structure | **Per-collection route files** (Option A) | HIPAA compliance: complete isolation per collection |
| Permission model | **Per-collection role whitelists** | Different staff access different medical data |
| Execution strategy | **Agents in ABC order with checkpoint tracking** | Manageable batches, resumable progress |

---

## 3. Reference Implementation: PatientVisitDocument

The existing `PatientVisitDocument.jsx` serves as the gold standard. Each template will replicate this pattern, customized to its own field structure.

### 3.1 Frontend State (per template)

```javascript
// Each template declares its own editing state — NOT imported from anywhere
const [editingField, setEditingField] = useState(null);   // "sectionId-recordIdx-sSentenceIdx"
const [editValue, setEditValue] = useState('');
const [saving, setSaving] = useState(false);
const [approving, setApproving] = useState(false);
const [localEdits, setLocalEdits] = useState({});          // field text overrides
const [statusOverrides, setStatusOverrides] = useState({}); // per-record status
const [editedFields, setEditedFields] = useState({});       // which sections were edited
const [editedSentences, setEditedSentences] = useState({}); // per-row 'edited'|'added' tags
const textareaRef = useRef(null);
```

### 3.2 Frontend Handlers (per template)

Each template gets its own copies of:

1. **`SECTION_FIELD_MAP`** — maps sectionId to the MongoDB field path for that template's collection
2. **`handleStartEdit(sectionId, idx, sentenceIdx, sentenceText)`** — opens inline textarea for a sentence
3. **`handleSaveField(record, sectionId, idx, sentenceIdx, allSentences)`** — saves edited sentence via API, detects edited/added/deleted rows
4. **`handleApprove(record, idx)`** — approves edits, clears all badges
5. **`handleCancelEdit()`** — cancels editing

### 3.3 Smart Row Detection Logic

```javascript
// In handleSaveField — determines 'edited' vs 'added' vs deleted
const newSentences = splitBySentence(fullText);
const extraCount = newSentences.length - allSentences.length;

if (extraCount > 0) {
  // New sentences created — check if original also changed
  if (originalText !== newTextAtIdx) {
    editedMap[`${sectionKey}-s${sentenceIdx}`] = 'edited';
  }
  for (let si = sentenceIdx + 1; si <= sentenceIdx + extraCount; si++) {
    editedMap[`${sectionKey}-s${si}`] = 'added';
  }
} else if (extraCount === 0) {
  editedMap[`${sectionKey}-s${sentenceIdx}`] = 'edited';
}
// extraCount < 0: deletion — no badges
```

### 3.4 Cross-Section Leak Prevention

```javascript
// Only show sentence badges if THIS section was edited
const sectionWasEdited = editedFields[sectionKey] || record.doctorEdits?.editedFields?.includes(fieldKey);
const sentenceState = sectionWasEdited ? editedSentences[`${sectionKey}-s${realIdx}`] : undefined;
```

### 3.5 Approve Clears All State

```javascript
// On approve — clear ALL badges across ALL sections
setEditedSentences({});
setEditedFields({});
```

---

## 4. Backend: Per-Collection Route Files

### 4.1 Directory Structure

```
apps/backend-api/routes/edit/
  allergies.js
  lab_results.js
  vital_signs.js
  medications.js
  progress_notes.js
  ... (one file per collection)
```

### 4.2 Route File Template

Each route file follows the same structure but with its own:
- Collection name
- Editable fields whitelist
- Read/write role lists
- Field path mappings (some collections use flat fields, others use nested paths like `aiSummary.field`)

```javascript
// routes/edit/allergies.js
const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const practiceContext = require('../../middleware/practiceContext');
const practiceModels = require('../../middleware/practiceModels');
const practiceAuth = require('../../middleware/practiceAuth');

// ── Collection-specific configuration ──────────────────────
const COLLECTION = 'allergies';
const READ_ROLES = ['admin', 'medical_director', 'doctor', 'doctor_specialist', 'nurse_rn', 'nurse_lpn'];
const WRITE_ROLES = ['admin', 'medical_director', 'doctor', 'doctor_specialist'];
const EDITABLE_FIELDS = ['allergen', 'reaction', 'severity', 'status', 'notes', 'onsetDate'];

// ── Middleware ──────────────────────────────────────────────
router.use(practiceContext);
router.use(practiceModels);
router.use(practiceAuth);

// ── Role check helpers ─────────────────────────────────────
const hasReadAccess = (userRole) => READ_ROLES.includes(userRole);
const hasWriteAccess = (userRole) => WRITE_ROLES.includes(userRole);

// ── PUT /:id/edit — Edit document fields ───────────────────
router.put('/:id/edit', async (req, res) => {
  try {
    const userRole = req.user?.role || req.user?.practiceRole;
    if (!hasWriteAccess(userRole)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions to edit' });
    }

    const { id } = req.params;
    const { edits } = req.body;
    if (!edits || typeof edits !== 'object') {
      return res.status(400).json({ success: false, error: 'edits object is required' });
    }

    const sda = req.secureDataAccess || require('../../services/secureDataAccess').getInstance();
    const context = { ...req.practiceContext, operation: 'update', serviceId: `${COLLECTION}-edit-service` };

    const setFields = {};
    const editedFieldNames = [];
    for (const field of EDITABLE_FIELDS) {
      if (edits[field] !== undefined) {
        setFields[field] = edits[field];
        editedFieldNames.push(field);
      }
    }

    if (editedFieldNames.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid editable fields provided' });
    }

    setFields['doctorEdits'] = {
      editedFields: editedFieldNames,
      editedAt: new Date(),
      editedBy: new ObjectId(req.user._id),
    };
    setFields['status'] = 'amended';

    await sda.update(COLLECTION, { _id: new ObjectId(id) }, { $set: setFields }, context);

    return res.json({ success: true, documentId: id, editedFields: editedFieldNames });
  } catch (err) {
    console.error(`[${COLLECTION}] PUT /:id/edit error:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── PUT /:id/approve — Approve edited document ────────────
router.put('/:id/approve', async (req, res) => {
  try {
    const userRole = req.user?.role || req.user?.practiceRole;
    if (!hasWriteAccess(userRole)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions to approve' });
    }

    const { id } = req.params;
    const sda = req.secureDataAccess || require('../../services/secureDataAccess').getInstance();
    const context = { ...req.practiceContext, operation: 'update', serviceId: `${COLLECTION}-edit-service` };

    await sda.update(COLLECTION, { _id: new ObjectId(id) }, {
      $set: {
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: new ObjectId(req.user._id),
      },
    }, context);

    return res.json({ success: true, documentId: id, status: 'approved' });
  } catch (err) {
    console.error(`[${COLLECTION}] PUT /:id/approve error:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /:id/permissions — Check user permissions ──────────
router.get('/:id/permissions', async (req, res) => {
  const userRole = req.user?.role || req.user?.practiceRole;
  return res.json({
    success: true,
    canRead: hasReadAccess(userRole),
    canWrite: hasWriteAccess(userRole),
    collection: COLLECTION,
  });
});

module.exports = router;
```

### 4.3 Route Registration

Each route file is registered in `routeLoaderService.js` under `/api/edit/<collection>`:

```javascript
// In routeLoaderService.js
{ path: '/api/edit/allergies', router: require('./routes/edit/allergies') },
{ path: '/api/edit/lab_results', router: require('./routes/edit/lab_results') },
// ... one entry per collection
```

### 4.4 Service Account Registration

Each collection's edit service must be registered in `secureDataAccess.js` system services:

```javascript
// In secureDataAccess.js systemServices
'allergies-edit-service': { permissions: ['*'], allowedCollections: ['allergies'], ... },
'lab_results-edit-service': { permissions: ['*'], allowedCollections: ['lab_results'], ... },
```

---

## 5. Permission Model

### 5.1 Default Role Assignments

Most templates will use this default, overridden per-template as needed:

| Role | Read | Write |
|------|------|-------|
| admin | Yes | Yes |
| medical_director | Yes | Yes |
| compliance_officer | Yes | No |
| doctor | Yes | Yes |
| doctor_specialist | Yes | Yes |
| nurse_rn | Yes | No |
| nurse_lpn | Yes | No |
| lab_tech | Varies | No |
| secretary | No | No |
| billing | No | No |
| receptionist | No | No |
| patient | No | No |

### 5.2 Collection-Specific Overrides

Some collections need different permissions:

| Collection | Write Override | Reason |
|-----------|---------------|--------|
| lab_results | +lab_tech write | Lab techs enter/correct results |
| medications | +nurse_rn write | Nurses administer medications |
| vital_signs | +nurse_rn, +nurse_lpn write | Nurses record vitals |
| nursing_assessments | +nurse_rn write | Nurses author assessments |
| billing | +billing write | Billing staff manage billing |
| prescriptions | doctor-only write | Only doctors prescribe |

---

## 6. Frontend API Integration

Each template calls its own collection-specific endpoint:

```javascript
// In AllergiesDocument.jsx
const response = await secureApiClient.put(`/api/edit/allergies/${recordId}/edit`, {
  edits: { [fieldKey]: fullText },
});

// In LabResultsDocument.jsx
const response = await secureApiClient.put(`/api/edit/lab_results/${recordId}/edit`, {
  edits: { [fieldKey]: fullText },
});
```

### 6.1 Permission-Aware UI

Each template checks permissions on mount to determine read-only vs editable:

```javascript
// Per-template permission check
const [canWrite, setCanWrite] = useState(false);
useEffect(() => {
  const checkPermissions = async () => {
    try {
      const res = await secureApiClient.get(`/api/edit/${COLLECTION}/${recordId}/permissions`);
      if (res.success) setCanWrite(res.canWrite);
    } catch { setCanWrite(false); }
  };
  if (records.length > 0 && records[0]._id) checkPermissions();
}, [records]);
```

When `canWrite` is false, the edit pencil icons and approve button are hidden — the template is read-only.

---

## 7. CSS Per Template

Each template's `.css` file already exists. The editing-specific styles are added per template:

```css
/* Added to each template's existing .css file */
.numbered-row.editing { border: 2px solid #3b82f6; background: #1a2744; }
.numbered-row.edited { border-left: 3px solid #f59e0b; }
.numbered-row.added { border-left: 3px solid #22c55e; }
.modified-badge { color: #f59e0b; font-size: 11px; font-style: italic; margin-left: 8px; }
.added-badge { color: #22c55e; font-size: 11px; font-style: italic; margin-left: 8px; }
.approve-btn { background: #22c55e; color: white; border: none; padding: 6px 16px; border-radius: 6px; cursor: pointer; }
.approve-btn:hover { background: #16a34a; }
.edit-icon { cursor: pointer; opacity: 0.6; font-size: 14px; margin-left: 4px; }
.edit-icon:hover { opacity: 1; }
```

---

## 8. PDF Templates

PDF templates remain **read-only** — no editing in PDF. They already display the current data including any edits that were saved and approved.

---

## 9. Execution Strategy

### 9.1 Processing Order

Templates are processed in **alphabetical order** (ABC).

### 9.2 Agent Structure

Each agent handles **one template** and performs these steps:

1. Read the template's JSX file to understand its field structure
2. Identify the MongoDB collection name and field paths
3. Add editing state variables (8 state declarations)
4. Add SECTION_FIELD_MAP for this template's fields
5. Add handleStartEdit, handleSaveField, handleApprove, handleCancelEdit
6. Update section rendering to include edit pencil icons, inline textarea, save/cancel buttons
7. Add edited/added badge rendering with sectionWasEdited guard
8. Add approve button in record header
9. Add permission check (canWrite state + useEffect)
10. Update the template's CSS file with editing styles
11. Create the per-collection backend route file
12. Register the route in routeLoaderService.js
13. Register the service account in secureDataAccess.js
14. Update checkpoint file

### 9.3 Checkpoint Tracking

A checkpoint file tracks progress:

```
docs/plans/template-editing-checkpoint.json
{
  "totalTemplates": 622,
  "completed": [],
  "inProgress": null,
  "remaining": ["ADHDAssessmentDocument", "AccessPlanningDocument", ...],
  "lastUpdated": "2026-02-20T...",
  "backendRoutes": {
    "created": [],
    "registered": []
  }
}
```

### 9.4 Batch Size

Process templates in batches of **5-10** per agent session, then checkpoint.

---

## 10. Collection Name Mapping

Each template maps to a specific MongoDB collection. The collection name is derived from:

1. The template's entry in `TEMPLATE_PATTERNS` (in `AIDocumentRenderer.jsx`)
2. The `AI_COLLECTIONS` array (in `DocumentDetailView.jsx`)
3. The `functionCollectionMap` (in `optimizedMedicalFunctions.js`)

Example mappings:
| Template | Collection |
|----------|-----------|
| AllergiesDocument | allergies |
| LabResultsDocument | lab_results |
| VitalSignsDocument | vital_signs |
| MedicationsDocument | medications |
| ProgressNotesDocument | progress_notes |
| PatientVisitDocument | patient_visits (already done) |

---

## 11. Checklist & Memory Updates

After all 622 templates are converted, update:

1. **Template creation checklist memory** (ID: `6982205e03e7615e84c02496`) — add editing requirements as rules #66-72
2. **MEMORY.md** — add editing pattern reference
3. **New memory** — store the per-collection route template for future templates

New checklist items to add:
- Rule #66: Every template MUST include editing state (8 useState declarations)
- Rule #67: Every template MUST have SECTION_FIELD_MAP mapping sectionId to MongoDB field path
- Rule #68: handleSaveField MUST detect edited/added/deleted with extraCount logic
- Rule #69: sectionWasEdited guard MUST prevent cross-section badge leaks
- Rule #70: handleApprove MUST clear ALL editedSentences and editedFields
- Rule #71: Every template MUST have corresponding per-collection backend route in routes/edit/
- Rule #72: Every template MUST check canWrite permission before showing edit UI

---

## 12. HIPAA Compliance Summary

| Requirement | How Addressed |
|------------|---------------|
| Access Control | Per-collection READ_ROLES/WRITE_ROLES whitelists |
| Audit Trail | doctorEdits object: editedFields, editedAt, editedBy |
| Minimum Necessary | EDITABLE_FIELDS whitelist per collection |
| Practice Isolation | secureDataAccess + practiceContext middleware (separate DB per practice) |
| Data Integrity | Approve workflow: edits are 'amended' until doctor approves |
| Route Isolation | Separate route file per collection — no shared handler code |

---

## 13. What's NOT In Scope

- PDF editing (PDFs remain read-only, display current data)
- Compose mode (only PatientVisitDocument has AI text→SOAP conversion)
- Version history / rollback (future enhancement)
- Real-time collaborative editing (future enhancement)
