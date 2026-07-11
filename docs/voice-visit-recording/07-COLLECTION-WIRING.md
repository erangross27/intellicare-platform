# Task 7: Collection Wiring + Template Registration

**Priority:** MEDIUM — Enables visit history viewing in artifact panel
**Estimated files:** 0 new, 6 modified
**Dependencies:** Task 2 (PatientVisit model), Task 5 (artifact panel changes)

---

## What to Build

Wire the `patient_visits` collection into IntelliCare's collection system so visits appear in the artifact panel and can be browsed/searched.

---

## Files to Modify (Standard 6-File Pattern)

### 1. `apps/backend-api/services/medicalCollectionsService.js`

Add `patient_visits` to `allCollections` array.

### 2. `apps/backend-api/services/optimizedMedicalFunctions.js`

Add to `functionCollectionMap`:
```javascript
getPatientVisits: 'patient_visits'
```

### 3. `apps/backend-api/services/secureDataAccess.js`

- Add `patient_visits` to BOTH `skipSoftDelete` arrays
- Already done in Task 2, verify it's there

### 4. `apps/frontend-vite/src/components/artifact/AIDocumentRenderer.jsx`

Add lazy import and TEMPLATE_PATTERNS entry:
```javascript
const PatientVisitDocument = lazy(() => import('./templates/PatientVisitDocument'));

// In TEMPLATE_PATTERNS:
{ pattern: /^patient[_\s]?visits?$/i, component: 'PatientVisitDocument' }
```

### 5. `apps/frontend-vite/src/components/artifact/DocumentDetailView.jsx`

Add `patient_visits` to `AI_COLLECTIONS` array.

### 6. `apps/frontend-vite/src/components/artifact/ArtifactPanel.jsx`

Add `patient_visits` to `DOCUMENT_VIEW_COLLECTIONS` array.

---

## Visit Template (Display in Artifact Panel)

### Create: `apps/frontend-vite/src/components/artifact/templates/PatientVisitDocument.jsx`
### Create: `apps/frontend-vite/src/components/artifact/templates/PatientVisitDocument.css`

This template displays saved visits (after approval) in the standard mini-card pattern:

**Sections:**
1. Visit Details — date, doctor, type, duration, status
2. Chief Complaint — single text field
3. History of Present Illness — text section
4. Review of Systems — text section
5. Physical Examination — text section
6. Assessment — text section
7. Plan — text section
8. Medications — text section
9. Follow-Up — text section
10. Transcript — expandable full transcript with speaker labels

**Note:** This is a READ-ONLY display template for viewing approved visits. The editable review happens in Task 5's review panel (before approval).

**Follow standard template checklist:** 3-prop pattern, 4-level search, Copy Section buttons, highlightText, mini-card pattern, etc.

---

## PDF Template

### Create: `apps/frontend-vite/src/components/artifact/pdf-templates/PatientVisitDocumentPDFTemplate.jsx`

Standard PDF with:
- Visit header (patient name, date, doctor, type)
- SOAP sections with sectionTitle + fieldValue pattern
- Transcript section (optional, can be long)
- Professional layout following existing PDF standards

---

## Agent System Prompt Registration

### Modify: `apps/backend-api/services/agentSystemPrompt.js`

Add CRUD tools for patient_visits:
- `createPatientVisit` (used internally by visit recording flow)
- `getPatientVisits` (browse visit history)
- `updatePatientVisit` (edit/amend visit notes)
- `deletePatientVisit` (soft-delete)

---

## Verification

- [ ] `patient_visits` appears in collection lists
- [ ] Visits render in artifact panel with mini-card pattern
- [ ] All SOAP sections display with Copy Section buttons
- [ ] Search works across all sections (4-level)
- [ ] PDF generates with professional layout
- [ ] Agent can query visit history for a patient
- [ ] Template follows all 65 checklist rules
