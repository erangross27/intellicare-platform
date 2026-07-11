# Missing-Templates Build — CHECKPOINT (resume state)

**Goal:** build templates for every MEDICAL collection that the unified schema has but no (correct) artifact template renders. Built from `unified-medical-schemas.json` field types ALONE (these collections have zero Mongo docs — the agent never selected them across 130 patients). Admin/system/scheduling/device/metadata collections are EXCLUDED.

**Resume protocol:** read this file top-to-bottom. The first `[ ]` (pending) row in the lowest-numbered incomplete wave is the next work. Build ≤3 collections per wave (Anthropic usage cap). After each wave: parent does the 5 shared registrations, verifies `--schema-only`, commits+pushes, then ticks the rows here and updates the memory.

<!-- RESUME-MARKER -->
**RESUME: ✅✅ ALL DONE — PHASE 1 (20/20) + PHASE 2 (39/39) COMPLETE. Every medical NO_MATCH + wrong-match collection now renders its own 100% schema-only template (JSX+PDF+typed-editing+route). No pending waves. If reopening: re-run the full-scope audit (checkTemplateCoverageAndOverlap.js per collection --schema-only) to find any NEW gaps; the 14 excluded admin/system collections remain intentionally out of scope. W12/W13 mostly REBUILD own-component (matched name == collection but <40% = old schema) OR parent-only anchor fix (own component+route correct, stolen by broad sibling pattern — like tractography_studies W11). ALWAYS check matched-component + registration state first. NOTE W9: fluid_electrolyte_management was a PARTIAL prior build whose anchored pattern sat AFTER the Hydration thief — REBUILT + moved anchor to TOP; neuropsych needed +3 schema fields the node dump truncated (always cross-check checker missing-list after registering). BEFORE building each: (1) check matched component — if it's the collection's OWN component at <40% → REBUILD JSX+PDF+route only (no routing change, e.g. blood_products_ordered); (2) grep AIDocumentRenderer for existing `const <Comp>Document = lazy` + detail/panel/route/sda to avoid DUPLICATES (e.g. mayo_score pre-existed). Add anchored /^col$/i at TOP of TEMPLATE_PATTERNS before the thief; verify thief + near-twin still 100% (no regression). See PHASE 2 section.**
<!-- /RESUME-MARKER -->

Last updated: 2026-06-16 (Phase 2 START — audit fix a92f578f5; 39-collection worklist set)

---

## Build recipe (apply the template-creation checklist TO THE LETTER — MCP memory 6982205e)
Per collection, one parallel subagent owns its 4 DISJOINT files; the PARENT does the 5 shared registrations + verification (avoids merge conflicts).

**4 files (subagent):**
1. `apps/frontend-vite/src/components/artifact/templates/<Name>Document.jsx` — blue-glow theme, 4-level search, per-section approve (yellow Pending→green Approved), per-row Copy + Copy Section + Copy All, **TYPED inline editing by field type**:
   - `number` → `<input type="number" step="any">`, saves `parseFloat`, hide-zero (donor: StemCellTransplantAssessmentDocument)
   - `boolean` → `<select>` Yes/No, saves real boolean (donor: StemCell)
   - `Date` → `<input type="date" className="edit-date">`, `formatDate`→YYYY-MM-DD (donor: MaternalWeightMonitoringDocument; DATE_FIELDS + renderDateField)
   - `string` → per-sentence editable text (donor: StemCell renderStringField)
   - `array` → numbered list, per-item edit (donor: StemCell renderArrayField, dot-path arrayIndex)
   - `object` → recursive sub-key render; booleans→Yes/No, value+unit→number (donor: MyositisAssessmentDocument renderObjectLeaf)
   - copied-state animation = BLUE (#2563eb), NOT green.
2. `.../templates/<Name>Document.css` — clone a sibling blue-glow CSS, re-scope root class; include `.edit-select`, `.edit-date`, `.save-error`, `.modified-badge.added`.
3. `apps/frontend-vite/src/components/artifact/pdf-templates/<Name>DocumentPDFTemplate.jsx` — B&W only (#000000 titles/borders), Rule #74 conditional-wrap (`wrap={items.length>8?undefined:false}`, sectionTitle INSIDE first present field's View; section View no wrap prop; only recordHeader `wrap={false}`).
4. `apps/backend-api/routes/edit/<collection>.js` — `sda.update` pattern (NEVER `accessData`); `ALLOWED_FIELDS` = ALL top-level extractable fields; register dash-style serviceId.

**5 shared registrations (PARENT, serial):**
- `AIDocumentRenderer.jsx`: lazy import + ANCHORED `/^<collection>$/i` TEMPLATE_PATTERNS entry placed BEFORE any broad thief pattern.
- `DocumentDetailView.jsx` AI_COLLECTIONS, `ArtifactPanel.jsx` DOCUMENT_VIEW_COLLECTIONS, `routeLoaderService.js` edit path, `secureDataAccess.js` serviceId.

**Verify (schema-only — no Mongo docs exist):**
`node apps/backend-api/scripts/checkTemplateCoverageAndOverlap.js <col> --schema-only` → target ✅ 100% (every extractable field rendered), no JSX-missing/PDF-missing. Plus `node --check` edit route, `npx esbuild <jsx/pdf> --loader:.jsx=jsx --outfile=/dev/null`.

---

## PHASE 1 — 20 NO_MATCH medical collections (no template at all)

### Wave 1  ✅ DONE (commit c35c95a46)
- [x] syphilis_treatment_follow_up   (25 fields → 100% schema-only)
- [x] varicose_vein_treatment        (24 fields → 100% schema-only)
- [x] heart_transplant_follow_up     (31 fields → 100% schema-only)

### Wave 2  ✅ DONE
- [x] kidney_transplant_follow_up    (25 fields → 100% schema-only)
- [x] foot_reconstruction            (25 fields → 100% schema-only)
- [x] pulmonary_rehabilitation       (25 fields → 100% schema-only)

### Wave 3  ✅ DONE
- [x] medication_action_plan         (25 fields → 100% schema-only)
- [x] polypharmacy                   (21 fields → 100% schema-only)
- [x] cesarean_threshold             (25 fields → 100% schema-only)

### Wave 4  ✅ DONE
- [x] diabetes_educator_training     (24 fields → 100% schema-only)
- [x] height_measurements            (23 fields → 100% schema-only)
- [x] point_of_care_ultrasound_heart_rate (14 fields → 100% schema-only)

### Wave 5  ✅ DONE
- [x] glucose_testing_weeks          (13 fields → 100% schema-only)
- [x] social_functional_assessment   (18 fields → 100% schema-only)
- [x] patient_emotional_response     (15 fields → 100% schema-only)

### Wave 6  ✅ DONE
- [x] support_group_referral         (16 fields → 100% schema-only)
- [x] partner_involvement            (21 fields → 100% schema-only)
- [x] admission_decisions            (14 fields → 100% schema-only)

### Wave 7  ✅ DONE — PHASE 1 COMPLETE (20/20)
- [x] post_op_testing                (19 fields → 100% schema-only)  ortho knee-exam
- [x] postop_testing                 (20 fields → 100% schema-only)  generic post-op

## PHASE 1 — EXCLUDED (14, not built: admin/system/scheduling/device/metadata/no-schema)
appointments(0 fields — do later for artifact display), headers, source, department, specialty_fields, optimization_stats, data_management_instructions, communication_preferences, medical_images(NO_SCHEMA), lab_schedule, glucometer_download_schedule, download_glucometer, care_team_info(dup of care_team), monitoring_reports(generic overlap).

---

## PHASE 2 — 39 genuinely-broken wrong-match collections (corrected June 16 2026)

⚠️ AUDIT-TOOL FIX FIRST (commit a92f578f5): checkTemplateCoverageAndOverlap.js had a nameless-entry parser bug that FALSELY flagged 7 of the original "46". After the fix, those 7 are FINE (route to their own dedicated component) — do NOT build them:
- code_blue_summaries 100%, rapid_response_summaries 100%, resuscitation_records 100% (perfect)
- day_programs 96% (gap: procedureCptCode), glomerular_disease 93% (gap: recommendations), headache_assessment 87% (headacheDiary/findings/recommendations), epilepsy_assessment 86% (seizureDiary/vagusNerveStimulator/recommendations) — minor additive gaps only, optional partial fixes, NOT rebuilds.

TRIAGE per collection (run `node apps/backend-api/scripts/checkTemplateCoverageAndOverlap.js <col> --schema-only` to see matched component + missing fields):
- **REBUILD** = routes to its OWN dedicated component but built for wrong/old schema → rebuild JSX+PDF+route ALLOWED_FIELDS only (already registered; NO routing change). Confirm by: matched component name == the collection's own component.
- **BUILD-NEW** = routes to a DIFFERENT/sibling component (steal) → build dedicated 4 files + add ANCHORED `/^col$/i` entry placed BEFORE the thief in TEMPLATE_PATTERNS (and narrow the thief's broad pattern if needed). Parent owns the routing change.
Likely REBUILD (own component, confirm): blood_products_ordered, colorectal_colonoscopies, follow_up_intelligence, gi_risk_assessment, intelligent_recommendations, goals_of_care_discussions, pre_operative_preparation. All others → BUILD-NEW.

### P2 Wave 1  ✅ DONE — anchored entries added at top of TEMPLATE_PATTERNS (before thieves); thieves still 100% on own collections
- [x] bone_marrow_transplant_evaluation   (25 fields → 100% schema-only)
- [x] bone_marrow_transplant_follow_up    (25 fields → 100% schema-only)
- [x] pancreas_transplant_follow_up       (25 fields → 100% schema-only)
### P2 Wave 2  ✅ DONE (anchored before Bone Marrow Studies / Disease Activity Scores; thieves still 96%/88%, no regression)
- [x] bone_marrow_reports                 (22 fields → 100%)
- [x] cytogenetics                        (16 fields → 100%)
- [x] mayo_score                          (23 fields → 100%; template pre-existed, routing-only fix)
### P2 Wave 3  ✅ DONE
- [x] blood_products                      (15 fields → 100%; BUILD-NEW, anchored)
- [x] blood_products_ordered              (23 fields → 100%; REBUILD own — routed correctly already, wrong schema)
- [x] pre_operative_preparation           (20 fields → 100%; BUILD-NEW PreOperativePreparationDocument, distinct from preoperative_preparation which stayed 100%)
### P2 Wave 4  ✅ DONE (all BUILD-NEW; thieves amniotic_fluid_assessment 93%, fetal_echo 100%, physical_examinations 100% — no regression)
- [x] amniotic_fluid_index_current        (13 → 100%)
- [x] fetal_echo_results                  (23 → 100%)
- [x] annual_physical_examination         (31 → 100%)
### P2 Wave 5  ✅ DONE (caregiver_support 100% + family_meeting_notes 94% + goals_of_care_discussion singular 100% — no regression)
- [x] caregiver_support_groups            (21 → 100%; BUILD-NEW)
- [x] family_meeting_decisions            (23 → 100%; BUILD-NEW)
- [x] goals_of_care_discussions           (8 → 100%; REBUILD plural GoalsOfCareDiscussionsDocument + anchored entry over the singular's broad /^goals.*care.*discussion/i pattern)
### P2 Wave 6  ✅ DONE (all BUILD-NEW; thieves geriatric_assessments 100%, chronic_disease_management 86% — no regression)
- [x] frailty_assessment                  (19 → 100%)
- [x] geriatric_nutritional_assessment    (20 → 100%)
- [x] chronic_disease_goals               (26 → 100%)
### P2 Wave 7  ✅ DONE (all BUILD-NEW; thieves cgm_data 86%, hypoglycemia_management 95%, endocrine_therapy 95% — no regression)
- [x] continuous_glucose_monitor_discussion (25 → 100%)
- [x] hypoglycemia_protocol               (25 → 100%)
- [x] hormone_therapy_records             (25 → 100%)
### P2 Wave 8  ✅ DONE (all BUILD-NEW; thieves ed_disposition 95%, medical_procedures 100%, surgical_approach 88% — no regression, pre-existing additive gaps only)
- [x] emergency_disposition               (26 → 100%)
- [x] procedure_requests                  (26 → 100%)
- [x] port_placement                      (18 → 100%)
### P2 Wave 9  ✅ DONE (thieves hydration_management 100%, urology_consultations 100%, neuropsychological_assessments 100% — no regression)
- [x] fluid_electrolyte_management        (22 → 100%; REBUILD to current schema + moved anchor to TOP before Hydration thief /^fluid.*management/i)
- [x] urology_assessment                  (16 → 100%; BUILD-NEW, object-heavy)
- [x] neuropsych_testing                   (25 → 100%; BUILD-NEW, +3 fields parent-patched: cognitiveReserveIndicators/cognitiveProfileSummary/testingAccommodations)
### P2 Wave 10  ✅ DONE (all BUILD-NEW; thieves environmental_exposures 100%, work_accommodations 87%, occupational_medicine_evaluations 85% — pre-existing additive gaps unchanged, no regression)
- [x] occupational_exposure_records       (26 → 100%)
- [x] fmla_documentation_note             (20 → 100%; no record date — title-only header)
- [x] workers_comp_evaluations            (22 → 100%; no record date — title-only header)
### P2 Wave 11  ✅ DONE (thieves pediatric_visits 100%, neuro_imaging 100% — no regression)
- [x] wellness_visit_documentation        (26 → 100%; BUILD-NEW, array-heavy)
- [x] allergies_assessments               (7 → 100%; REBUILD own AllergiesAssessmentDocument to 6-field schema + created route)
- [x] tractography_studies                (7 → 100%; parent-only anchor fix — own component/route already correct, was stolen by Neuro Imaging /^tractography/i)
### P2 Wave 12  ✅ DONE (thief doctors_medication_recommendations 78% — pre-existing additive gap, own component, no regression)
- [x] doctors_medications_recommendations_optimizations (28 → 100%; BUILD-NEW)
- [x] intelligent_recommendations         (16 → 100%; REBUILD own, object+array)
- [x] follow_up_intelligence              (26 → 100%; REBUILD own, array-heavy)
### P2 Wave 13  ✅ DONE — PHASE 2 COMPLETE (39/39)
- [x] colorectal_colonoscopies            (24 → 100%; REBUILD own)
- [x] gi_risk_assessment                  (14 → 100%; built dedicated GiRiskAssessmentDocument [camelCase] + anchored pattern; legacy all-caps GIRiskAssessmentDocument kept for bleeding-risk siblings)
- [x] trend_analysis                      (15 → 100%; BUILD-NEW — distinct from trending_analysis which keeps its own component)

---

## COMPLETED LOG (append one line per wave: wave, collections, commit hash)
- P1 W1 | syphilis_treatment_follow_up, varicose_vein_treatment, heart_transplant_follow_up | c35c95a46 | 3/3 100% schema-only
- P1 W2 | kidney_transplant_follow_up, foot_reconstruction, pulmonary_rehabilitation | ffa068110 | 3/3 100% schema-only
- P1 W3 | medication_action_plan, polypharmacy, cesarean_threshold | 3c14224da | 3/3 100% schema-only
- P1 W4 | diabetes_educator_training, height_measurements, point_of_care_ultrasound_heart_rate | 31b7ba4dc | 3/3 100% schema-only
- P1 W5 | glucose_testing_weeks, social_functional_assessment, patient_emotional_response | 0f7ce9511 | 3/3 100% schema-only
- P1 W6 | support_group_referral, partner_involvement, admission_decisions | c1789f583 | 3/3 100% schema-only
- P1 W7 | post_op_testing, postop_testing | 3fdcad076 | 2/2 100% schema-only — ★ PHASE 1 COMPLETE (20/20)
- AUDIT FIX | checkTemplateCoverageAndOverlap.js eval-parse (nameless-entry bug) | a92f578f5 | 46→39 real gaps (7 artifacts)
- P2 W1 | bone_marrow_transplant_evaluation, bone_marrow_transplant_follow_up, pancreas_transplant_follow_up | e53ddddfa | 3/3 100% schema-only; anchored before Transplant Assessment / Pancreas Transplant Evaluation thieves; no regression
- P2 W2 | bone_marrow_reports, cytogenetics, mayo_score | 3e3eaf156 | 3/3 100%; anchored before Bone Marrow Studies / Disease Activity Scores; mayo_score was routing-only (template pre-existed)
- P2 W3 | blood_products, blood_products_ordered, pre_operative_preparation | c5879d093 | 3/3 100%; blood_products_ordered REBUILD (own, wrong schema); pre_operative_preparation BUILD-NEW distinct from preoperative_preparation (stayed 100%)
- P2 W4 | amniotic_fluid_index_current, fetal_echo_results, annual_physical_examination | 6e3dfb016 | 3/3 100% BUILD-NEW; thieves no regression
- P2 W5 | caregiver_support_groups, family_meeting_decisions, goals_of_care_discussions | 749170157 | 3/3 100%; goals = REBUILD plural + anchored (singular/plural near-twin collision)
- P2 W6 | frailty_assessment, geriatric_nutritional_assessment, chronic_disease_goals | eca30e454 | 3/3 100% BUILD-NEW; thieves no regression
- P2 W7 | continuous_glucose_monitor_discussion, hypoglycemia_protocol, hormone_therapy_records | (this commit) | 3/3 100% BUILD-NEW; thieves no regression
