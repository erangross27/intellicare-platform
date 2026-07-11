# Template Editing System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-sentence inline editing, approval workflow, and per-collection backend routes to all 622 artifact templates.

**Architecture:** Each template gets its own self-contained editing logic (no shared hooks/CSS). Each collection gets its own backend route file in `routes/edit/`. Templates are converted alphabetically with checkpoint tracking.

**Tech Stack:** React (useState/useCallback/useRef), Express routes, MongoDB ($set), secureDataAccess service, practiceContext/practiceModels/practiceAuth middleware.

**Reference Implementation:** `PatientVisitDocument.jsx` (already has editing) — lines 38-233.

---

## Pre-Requisites

Before converting any template, the agent MUST read these files to understand the patterns:

1. `apps/frontend-vite/src/components/artifact/templates/PatientVisitDocument.jsx` — the gold standard editing implementation
2. `apps/frontend-vite/src/components/artifact/templates/PatientVisitDocument.css` — the editing CSS
3. `apps/backend-api/routes/visitRecording.js` lines 264-370 — the edit/approve endpoint pattern
4. This plan document

---

## Task 1: Create the Backend Route Template Generator

**Goal:** Create a template file that agents copy for each collection's route.

**Files:**
- Create: `apps/backend-api/routes/edit/_template.js` (reference, not loaded by Express)

**Step 1: Create the route template file**

```javascript
/**
 * Document Edit Route — [COLLECTION_NAME]
 * Per-collection editing endpoint with HIPAA-compliant isolation.
 *
 * Endpoints:
 *   PUT  /api/edit/[COLLECTION_NAME]/:id/edit    — Edit document fields
 *   PUT  /api/edit/[COLLECTION_NAME]/:id/approve  — Approve edits
 *   GET  /api/edit/[COLLECTION_NAME]/:id/permissions — Check user permissions
 */

const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { practiceAuth } = require('../../middleware/practiceAuth');
const { practiceContext, practiceModels } = require('../../middleware/practiceContext');

// Lazy-loaded secureDataAccess
let secureDataAccess;
function getSecureDataAccess() {
  if (!secureDataAccess) secureDataAccess = require('../../services/secureDataAccess');
  return secureDataAccess;
}

// ── Collection-Specific Configuration ─────────────────────
const COLLECTION = '__COLLECTION_NAME__';
const SERVICE_ID = `${COLLECTION}-edit-service`;

const READ_ROLES = ['admin', 'medical_director', 'doctor', 'doctor_specialist', 'nurse_rn', 'nurse_lpn'];
const WRITE_ROLES = ['admin', 'medical_director', 'doctor', 'doctor_specialist'];

// Fields that can be edited via the API (whitelist)
const EDITABLE_FIELDS = [
  // __FIELD_LIST__ — populate from MongoDB document structure
];

// ── Middleware ─────────────────────────────────────────────
router.use(practiceContext);
router.use(practiceModels);
router.use(practiceAuth);

// ── Helpers ───────────────────────────────────────────────
function buildContext(req, operation = 'read') {
  return {
    serviceId: SERVICE_ID,
    userId: req.user?.id,
    operation,
    practiceId: req.practiceContext?.subdomain || req.practiceContext?.practiceId,
    permissions: [operation === 'read' ? 'read' : 'write'],
  };
}

function toObjectId(str) {
  try { return new ObjectId(str); }
  catch { return str; }
}

const hasReadAccess = (userRole) => READ_ROLES.includes(userRole);
const hasWriteAccess = (userRole) => WRITE_ROLES.includes(userRole);

// ── PUT /:id/edit ─────────────────────────────────────────
router.put('/:id/edit', async (req, res) => {
  try {
    const userRole = req.user?.role || req.user?.practiceRole;
    if (!hasWriteAccess(userRole)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions to edit this document' });
    }

    const { id } = req.params;
    const { edits } = req.body;
    if (!edits || typeof edits !== 'object') {
      return res.status(400).json({ success: false, error: 'edits object is required' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

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
      editedBy: toObjectId(req.user._id || req.user.id),
    };
    setFields['status'] = 'amended';

    await sda.update(COLLECTION, { _id: toObjectId(id) }, { $set: setFields }, context);

    return res.json({ success: true, documentId: id, editedFields: editedFieldNames });
  } catch (err) {
    console.error(`[${COLLECTION}] PUT /:id/edit error:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── PUT /:id/approve ──────────────────────────────────────
router.put('/:id/approve', async (req, res) => {
  try {
    const userRole = req.user?.role || req.user?.practiceRole;
    if (!hasWriteAccess(userRole)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions to approve' });
    }

    const { id } = req.params;
    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    await sda.update(COLLECTION, { _id: toObjectId(id) }, {
      $set: {
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: toObjectId(req.user._id || req.user.id),
      },
    }, context);

    return res.json({ success: true, documentId: id, status: 'approved' });
  } catch (err) {
    console.error(`[${COLLECTION}] PUT /:id/approve error:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /:id/permissions ──────────────────────────────────
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

**Step 2: Verify the file exists**

Run: `ls -la apps/backend-api/routes/edit/_template.js`
Expected: File listed

**Step 3: Commit**

```bash
git add apps/backend-api/routes/edit/_template.js
git commit -m "feat: add per-collection edit route template"
```

---

## Task 2: Create the Checkpoint Tracking File

**Goal:** Track which templates have been converted.

**Files:**
- Create: `docs/plans/template-editing-checkpoint.json`

**Step 1: Generate checkpoint JSON with all template names**

The checkpoint file must list ALL 622 templates in `remaining` array (alphabetical).

Run this to generate:
```bash
ls apps/frontend-vite/src/components/artifact/templates/*.jsx \
  | xargs -I{} basename {} .jsx \
  | grep -v PDFTemplate \
  | grep -v '_OLD' \
  | grep -v '^PatientVisitDocument$' \
  | sort
```

Note: Exclude `PatientVisitDocument` (already has editing) and any `*_OLD` / `*PDFTemplate` files.

**Step 2: Create the JSON file**

```json
{
  "totalTemplates": 621,
  "completed": ["PatientVisitDocument"],
  "inProgress": null,
  "failed": [],
  "remaining": ["ADHDAssessmentDocument", "AccessPlanningDocument", ...],
  "backendRoutes": {
    "created": ["patient_visits"],
    "registered": ["patient_visits"]
  },
  "lastUpdated": "2026-02-20T00:00:00.000Z"
}
```

**Step 3: Commit**

```bash
git add docs/plans/template-editing-checkpoint.json
git commit -m "feat: add template editing checkpoint tracker"
```

---

## Task 3: Create the First Backend Edit Route (allergies)

**Goal:** Convert the route template into a real per-collection route for `allergies`.

**Files:**
- Create: `apps/backend-api/routes/edit/allergies.js`
- Modify: `apps/backend-api/services/routeLoaderService.js` (add route registration)

**Step 1: Query MongoDB to get the actual allergies field structure**

Use MCP tool:
```
mcp__intellicare-mongodb__find_documents({
  database: "intellicare_practice_yale",
  collection: "allergies",
  limit: 1
})
```

Examine the returned document to identify all editable fields.

**Step 2: Create `routes/edit/allergies.js`**

Copy `_template.js` and customize:
- `COLLECTION = 'allergies'`
- `EDITABLE_FIELDS` = actual field names from MongoDB document
- `READ_ROLES` / `WRITE_ROLES` = appropriate for allergies (nurses can read but not write)

**Step 3: Register the route in routeLoaderService.js**

Add to the `defineRoutes()` array, in a new section:

```javascript
// ===== DOCUMENT EDITING (Per-Collection) =====
{ path: '/api/edit/allergies', file: './routes/edit/allergies' },
```

**Step 4: Verify route loads**

Run: `cd apps/backend-api && node -e "require('./routes/edit/allergies')"`
Expected: No errors

**Step 5: Commit**

```bash
git add apps/backend-api/routes/edit/allergies.js apps/backend-api/services/routeLoaderService.js
git commit -m "feat: add per-collection edit route for allergies"
```

---

## Task 4: Convert AllergiesDocument.jsx — Add Editing

**Goal:** Add inline editing to AllergiesDocument as the first template conversion.

This is the most detailed task — it serves as the reference for all subsequent conversions.

**Files:**
- Modify: `apps/frontend-vite/src/components/artifact/templates/AllergiesDocument.jsx`
- Modify: `apps/frontend-vite/src/components/artifact/templates/AllergiesDocument.css`

### Step 1: Read the current AllergiesDocument.jsx completely

Understand:
- What fields does it render?
- How are sections structured (each allergy = one section)?
- What is the SECTION_FIELD_MAP for this template?

### Step 2: Add imports and constants

At the top of AllergiesDocument.jsx, add:

```javascript
import { useRef } from 'react';  // Add to existing React import
import secureApiClient from '../../../services/secureApiClient';

// Map sectionId → MongoDB field for the allergies collection
// Each allergy is its own record, so fields are top-level
const SECTION_FIELD_MAP = {
  allergen: 'allergen',
  reaction: 'reaction',
  severity: 'severity',
  type: 'type',
  status: 'status',
  management: 'management',
  compliance: 'compliance',
  notes: 'notes',
  dateIdentified: 'dateIdentified',
};

const COLLECTION = 'allergies';

// Split text into sentences (title-protected)
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|etc|\d))\.\s+/)
    .map(s => s.replace(/\.$/, '').trim())
    .filter(Boolean);
};

const stripNumber = (text) => {
  if (!text) return text;
  return text.replace(/^\d+\.\s*/, '').trim();
};
```

### Step 3: Add editing state declarations

Inside the component function, after existing useState declarations:

```javascript
// Editing state
const [editingField, setEditingField] = useState(null);
const [editValue, setEditValue] = useState('');
const [saving, setSaving] = useState(false);
const [approving, setApproving] = useState(false);
const [localEdits, setLocalEdits] = useState({});
const [statusOverrides, setStatusOverrides] = useState({});
const [editedFields, setEditedFields] = useState({});
const [editedSentences, setEditedSentences] = useState({});
const [canWrite, setCanWrite] = useState(false);
const textareaRef = useRef(null);
```

### Step 4: Add permission check useEffect

```javascript
// Check write permissions on mount
useEffect(() => {
  const checkPermissions = async () => {
    try {
      const firstRecord = unwrappedData[0];
      if (!firstRecord?._id) return;
      const res = await secureApiClient.get(`/api/edit/${COLLECTION}/${firstRecord._id}/permissions`);
      if (res.success) setCanWrite(res.canWrite);
    } catch { setCanWrite(false); }
  };
  if (unwrappedData.length > 0) checkPermissions();
}, [unwrappedData]);
```

### Step 5: Add edit handler functions

Copy the handler pattern from PatientVisitDocument, adapted for allergies:

```javascript
const getFieldValue = useCallback((record, sectionId, idx) => {
  const editKey = `${sectionId}-${idx}`;
  if (localEdits[editKey] !== undefined) return localEdits[editKey];
  const fieldKey = SECTION_FIELD_MAP[sectionId];
  return record[fieldKey] || null;
}, [localEdits]);

const handleStartEdit = useCallback((sectionId, idx, sentenceIdx, sentenceText) => {
  const editKey = `${sectionId}-${idx}-s${sentenceIdx}`;
  setEditingField(editKey);
  setEditValue(sentenceText || '');
  setTimeout(() => textareaRef.current?.focus(), 50);
}, []);

const handleCancelEdit = useCallback(() => {
  setEditingField(null);
  setEditValue('');
}, []);

const handleSaveField = useCallback(async (record, sectionId, idx, sentenceIdx, allSentences) => {
  const recordId = record._id;
  if (!recordId) return;
  const fieldKey = SECTION_FIELD_MAP[sectionId];
  if (!fieldKey) return;

  const updatedSentences = [...allSentences];
  updatedSentences[sentenceIdx] = editValue.trim();
  const fullText = updatedSentences.join('. ') + '.';

  setSaving(true);
  try {
    const response = await secureApiClient.put(`/api/edit/${COLLECTION}/${recordId}/edit`, {
      edits: { [fieldKey]: fullText },
    });
    if (response.success) {
      const sectionKey = `${sectionId}-${idx}`;
      setLocalEdits(prev => ({ ...prev, [sectionKey]: fullText }));
      setEditedFields(prev => ({ ...prev, [sectionKey]: true }));
      setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));

      const newSentences = splitBySentence(fullText);
      const editedMap = {};
      const extraCount = newSentences.length - allSentences.length;

      if (extraCount > 0) {
        const originalText = (allSentences[sentenceIdx] || '').trim();
        const newTextAtIdx = (newSentences[sentenceIdx] || '').trim();
        if (originalText !== newTextAtIdx) {
          editedMap[`${sectionKey}-s${sentenceIdx}`] = 'edited';
        }
        for (let si = sentenceIdx + 1; si <= sentenceIdx + extraCount; si++) {
          editedMap[`${sectionKey}-s${si}`] = 'added';
        }
      } else if (extraCount === 0) {
        editedMap[`${sectionKey}-s${sentenceIdx}`] = 'edited';
      }

      setEditedSentences(prev => {
        const updated = {};
        for (const key of Object.keys(prev)) {
          if (!key.startsWith(`${sectionKey}-s`)) updated[key] = prev[key];
        }
        return { ...updated, ...editedMap };
      });
      setEditingField(null);
      setEditValue('');
    }
  } catch (err) {
    console.error(`[${COLLECTION}] Save error:`, err);
  } finally {
    setSaving(false);
  }
}, [editValue]);

const handleApprove = useCallback(async (record, idx) => {
  const recordId = record._id;
  if (!recordId) return;
  setApproving(true);
  try {
    const response = await secureApiClient.put(`/api/edit/${COLLECTION}/${recordId}/approve`);
    if (response.success) {
      setStatusOverrides(prev => ({ ...prev, [idx]: 'approved' }));
      setEditedSentences({});
      setEditedFields({});
    }
  } catch (err) {
    console.error(`[${COLLECTION}] Approve error:`, err);
  } finally {
    setApproving(false);
  }
}, []);
```

### Step 6: Update section rendering — add edit icons, inline textarea, badges

For each `numbered-row` that displays field values, wrap the content to support editing.

**Pattern for a single-value field (e.g., allergen, severity):**

```jsx
{/* Before the closing </div> of each numbered-row */}
{canWrite && !editingField && (
  <span className="edit-icon" onClick={() => handleStartEdit(sectionId, idx, 0, fieldValue)}>
    ✏️
  </span>
)}
```

**Pattern for multi-sentence fields (e.g., notes, management):**

Each sentence gets its own numbered-row with edit capability:

```jsx
{sentences.map((sentence, si) => {
  const realIdx = si;
  const sectionKey = `${sectionId}-${idx}`;
  const sectionWasEdited = editedFields[sectionKey];
  const sentenceState = sectionWasEdited ? editedSentences[`${sectionKey}-s${realIdx}`] : undefined;
  const isEditing = editingField === `${sectionId}-${idx}-s${si}`;
  const isSentenceEdited = sentenceState === 'edited';
  const isSentenceAdded = sentenceState === 'added';

  return (
    <div key={si} className={`numbered-row${isSentenceEdited ? ' edited' : ''}${isSentenceAdded ? ' added' : ''}`}>
      {isEditing ? (
        <div className="edit-inline">
          <textarea ref={textareaRef} value={editValue} onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') handleCancelEdit(); }} />
          <div className="edit-actions">
            <button className="save-btn" onClick={() => handleSaveField(record, sectionId, idx, si, sentences)} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="row-content">
          <span className="row-number">{si + 1}.</span>
          <span className="content-value">{highlightText(stripNumber(sentence))}</span>
          {isSentenceEdited && <span className="modified-badge">edited — click approve to save</span>}
          {isSentenceAdded && <span className="added-badge">added — click approve to save</span>}
          {canWrite && (
            <span className="edit-icon" onClick={() => handleStartEdit(sectionId, idx, si, sentence)}>✏️</span>
          )}
        </div>
      )}
    </div>
  );
})}
```

### Step 7: Add approve button to record header

```jsx
{/* Inside record header, next to existing buttons */}
{canWrite && statusOverrides[idx] === 'amended' && (
  <button className="approve-btn" onClick={() => handleApprove(record, idx)} disabled={approving}>
    {approving ? 'Approving...' : 'Approve Changes'}
  </button>
)}
```

### Step 8: Add editing CSS to AllergiesDocument.css

Append to the end of `AllergiesDocument.css`:

```css
/* ── Editing Styles ─────────────────────────────────────── */
.numbered-row.editing { border: 2px solid #3b82f6; background: #1a2744; }
.numbered-row.edited { border-left: 3px solid #f59e0b; }
.numbered-row.added { border-left: 3px solid #22c55e; }

.modified-badge {
  color: #f59e0b; font-size: 11px; font-style: italic;
  margin-left: 8px; white-space: nowrap;
}
.added-badge {
  color: #22c55e; font-size: 11px; font-style: italic;
  margin-left: 8px; white-space: nowrap;
}

.edit-icon {
  cursor: pointer; opacity: 0.4; font-size: 14px;
  margin-left: 6px; transition: opacity 0.2s;
}
.edit-icon:hover { opacity: 1; }

.edit-inline { width: 100%; }
.edit-inline textarea {
  width: 100%; min-height: 60px; padding: 8px;
  background: #0f1d32; color: #e2e8f0; border: 1px solid #3b82f6;
  border-radius: 6px; font-size: 14px; font-family: inherit;
  resize: vertical;
}
.edit-actions { display: flex; gap: 8px; margin-top: 6px; }
.save-btn {
  background: #3b82f6; color: white; border: none;
  padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;
}
.save-btn:hover { background: #2563eb; }
.save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.cancel-btn {
  background: transparent; color: #94a3b8; border: 1px solid #475569;
  padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;
}
.cancel-btn:hover { color: #e2e8f0; border-color: #94a3b8; }

.approve-btn {
  background: #22c55e; color: white; border: none;
  padding: 6px 16px; border-radius: 6px; cursor: pointer;
  font-size: 13px; font-weight: 600;
}
.approve-btn:hover { background: #16a34a; }
.approve-btn:disabled { opacity: 0.5; cursor: not-allowed; }
```

### Step 9: Commit

```bash
git add apps/frontend-vite/src/components/artifact/templates/AllergiesDocument.jsx
git add apps/frontend-vite/src/components/artifact/templates/AllergiesDocument.css
git commit -m "feat: add inline editing to AllergiesDocument"
```

### Step 10: Update checkpoint

Update `docs/plans/template-editing-checkpoint.json`:
- Move "AllergiesDocument" from `remaining` to `completed`
- Update `lastUpdated`
- Add `allergies` to `backendRoutes.created` and `backendRoutes.registered`

---

## Task 5: Convert Second Template (AccessPlanningDocument) — Validate Pattern

**Goal:** Convert the second template to validate the pattern works consistently.

**Same steps as Task 4, but for AccessPlanningDocument:**

1. Query MongoDB for `access_planning` collection structure
2. Create `routes/edit/access_planning.js` from template
3. Register route in routeLoaderService.js
4. Add editing state/handlers to AccessPlanningDocument.jsx
5. Add editing CSS to AccessPlanningDocument.css
6. Commit
7. Update checkpoint

---

## Task 6+: Batch Template Conversion (Remaining ~620 Templates)

**Goal:** Convert all remaining templates in alphabetical batches.

### Per-Template Checklist (Agent Must Follow)

For EACH template:

1. **Read the template JSX** to understand its field structure
2. **Query MongoDB** for the collection's document structure (field names, types)
3. **Determine the collection name** from TEMPLATE_PATTERNS in AIDocumentRenderer.jsx
4. **Create backend route** `routes/edit/<collection_name>.js`:
   - Copy from `_template.js`
   - Set `COLLECTION`, `EDITABLE_FIELDS`, `READ_ROLES`, `WRITE_ROLES`
   - Register in routeLoaderService.js
5. **Add frontend editing** to the template JSX:
   - Import `secureApiClient` and `useRef`
   - Add `SECTION_FIELD_MAP` mapping sectionIds to field paths
   - Add `COLLECTION` constant
   - Add `splitBySentence` and `stripNumber` functions
   - Add 9 editing state variables
   - Add `getFieldValue`, `handleStartEdit`, `handleCancelEdit`, `handleSaveField`, `handleApprove`
   - Add permission check `useEffect`
   - Update section rendering with edit icons, inline textarea, save/cancel, badges
   - Add approve button in record header
6. **Add editing CSS** to the template's .css file
7. **Commit** the template
8. **Update checkpoint** JSON

### Batch Execution Strategy

- Process 5-10 templates per agent session
- Each batch follows alphabetical order from the `remaining` array
- After each batch, verify the checkpoint file is up-to-date
- If a template has unusual structure (bar charts, grouped data, complex nested objects), note it in checkpoint's `notes` field but still convert it

### Templates with Special Considerations

Some templates have unique rendering that needs adaptation:

| Template | Special Handling |
|----------|-----------------|
| LabResultsDocument | Bar charts — editing applies to text fields, not chart values |
| MedicationsDocument | Grouped by status — editing per medication record |
| VitalSignsDocument | Table format — editing per vital sign entry |
| Any *TableDocument | Table layout — editing per cell or row |
| BloodPressureReadingsDocument | Chart + readings — editing text fields only |

For chart-based templates: editing applies to the text/notes fields, NOT to the numeric chart data. The bar chart values come from lab results and should not be inline-editable.

### Role Override Reference

Use these role overrides when creating backend routes:

| Collection Pattern | WRITE_ROLES Override |
|-------------------|---------------------|
| lab_results, lab_* | +lab_tech |
| vital_signs, blood_pressure_*, weight_* | +nurse_rn, +nurse_lpn |
| nursing_*, nurse_* | +nurse_rn |
| medications, medication_*, prescriptions | doctor, admin, medical_director only |
| billing, insurance_* | +billing |
| patient_education_*, instructions | +nurse_rn |
| psychiatric_*, mental_health_* | +doctor_specialist |

Default for all other collections:
```javascript
const WRITE_ROLES = ['admin', 'medical_director', 'doctor', 'doctor_specialist'];
```

---

## Task 7: Register All Backend Routes

**Goal:** After all route files are created, ensure routeLoaderService.js has all entries.

**File:** `apps/backend-api/services/routeLoaderService.js`

Add a new section after the existing routes:

```javascript
// ===== DOCUMENT EDITING (Per-Collection Routes) =====
{ path: '/api/edit/allergies', file: './routes/edit/allergies' },
{ path: '/api/edit/access_planning', file: './routes/edit/access_planning' },
// ... one entry per collection (added incrementally in Tasks 3-6)
```

Note: Each template conversion task (Tasks 3-6) adds its own route registration entry. This task is just a final verification that all entries are present.

---

## Task 8: Update Template Creation Checklist Memory

**Goal:** Add editing requirements to the master checklist for future templates.

After ALL templates are converted, update MCP memory ID `6982205e03e7615e84c02496` with new rules:

- Rule #66: Every template MUST include editing state (9 useState + 1 useRef)
- Rule #67: Every template MUST have SECTION_FIELD_MAP for its fields
- Rule #68: handleSaveField MUST detect edited/added/deleted with extraCount logic
- Rule #69: sectionWasEdited guard MUST prevent cross-section badge leaks
- Rule #70: handleApprove MUST clear ALL editedSentences and editedFields
- Rule #71: Every template MUST have per-collection backend route in routes/edit/
- Rule #72: Every template MUST check canWrite permission before showing edit UI
- Rule #73: Editing CSS (7 classes) MUST be in each template's own .css file

---

## Verification Checklist (Per Template)

Before marking a template as complete, verify:

- [ ] Backend route file exists in `routes/edit/<collection>.js`
- [ ] Route registered in `routeLoaderService.js`
- [ ] `SECTION_FIELD_MAP` maps all editable fields
- [ ] `COLLECTION` constant matches the route path
- [ ] 9 editing state variables declared
- [ ] Permission check `useEffect` present
- [ ] `handleSaveField` has extraCount logic for edited/added/deleted
- [ ] `sectionWasEdited` guard prevents cross-section leaks
- [ ] `handleApprove` clears `editedSentences` and `editedFields`
- [ ] Edit icon appears on each numbered-row (only when canWrite)
- [ ] Inline textarea with save/cancel buttons works
- [ ] Edited/added badges display correctly
- [ ] Approve button appears in record header when status is 'amended'
- [ ] CSS has all 7 editing classes
- [ ] Checkpoint file updated
