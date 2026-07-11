#!/usr/bin/env bash
# PreToolUse Hook - Runs BEFORE every tool execution
# Created: October 2025
# Updated: June 2026 - Fixed to read JSON from stdin (Claude Code passes hook
#          data as JSON on stdin, NOT as command-line arguments) and to emit
#          hookSpecificOutput.additionalContext JSON (plain stdout from
#          PreToolUse hooks is only shown in transcript mode, never to Claude).
#
# Stdin JSON shape:
# {
#   "session_id": "...", "cwd": "...", "hook_event_name": "PreToolUse",
#   "tool_name": "Edit", "tool_input": { ... tool-specific ... }
# }

INPUT=$(cat)

# python3 parses the stdin payload (jq is NOT installed on this machine — a silent
# `command -v jq || exit 0` guard left this hook dead for months; do not reintroduce it).
command -v python3 >/dev/null 2>&1 || exit 0

# json_field <dot.path> [fallback.path] — extract a string field from $INPUT ('' when absent)
json_field() {
  printf '%s' "$INPUT" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    for path in sys.argv[1:]:
        v = d
        for k in path.split('.'):
            v = v.get(k, None) if isinstance(v, dict) else None
        if isinstance(v, str) and v:
            print(v)
            break
except Exception:
    pass
" "$@"
}

TOOL_NAME=$(json_field tool_name toolName)

# Wrap a plain-text message in the JSON envelope Claude actually receives
emit_context() {
  printf '%s' "$1" | python3 -c "
import json, sys
print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PreToolUse', 'additionalContext': sys.stdin.read()}}))
"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# VALIDATION #1: Code Modification Tools
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [[ "$TOOL_NAME" == "Edit" ]] || [[ "$TOOL_NAME" == "Write" ]] || [[ "$TOOL_NAME" == "NotebookEdit" ]] \
   || [[ "$TOOL_NAME" == "search_replace" ]] || [[ "$TOOL_NAME" == "write" ]]; then
  FILE_PATH=$(json_field tool_input.file_path toolInput.file_path tool_input.path toolInput.path tool_input.notebook_path toolInput.notebook_path)

  # ─── IntelliCare template files → inject the ONE-PASS POLISH AUDIT (July 2026) ───
  if [[ "$FILE_PATH" == */components/artifact/templates/*Document.jsx ]] \
     || [[ "$FILE_PATH" == */components/artifact/templates/*Document.css ]] \
     || [[ "$FILE_PATH" == */components/artifact/pdf-templates/* ]]; then
    MSG=$(cat <<'EOF'
🧩 TEMPLATE FILE EDIT — ONE-PASS POLISH AUDIT (full memory: search "template one-pass polish audit")
⭐⭐ GATE (run BEFORE declaring ANY one-pass done — the widget harness ALONE is NOT the gate): cd apps/frontend-vite && node scripts/auditTemplate.mjs <TemplateName> <record.json> → exit 0 means all 11 items are green (approve button standard, copy EQ/DASH dividers + no side-by-side, PDF box-free underline rules, titles/fileName, RTL, enum dup-guard, widgets probed>0, Copy All + PDF render clean, ⭐ Mongo/JSX/PDF FIELD PARITY — every populated JSX SECTION_FIELDS field's label actually renders in the DOM-mock-rendered PDF, catching a field present in the JSX/record but MISSING from the PDF's OWN hardcoded field-config arrays: the EdTriageAssessment 'date missing from the PDF, header showed createdAt' bug, memory 6a4bb189). ⛔ NEVER key a PDF record-date off createdAt/updatedAt (ingestion timestamps) — render the SAME record.date the JSX edits. Fetch the REAL record via the Mongo MCP to a JSON file first. Details at item VERIFY below + memory 6a4b8964.
⭐ EDIT SAVE/CANCEL = LEFT (standing user pref, memory 6a4b923a, user-caught twice): .edit-actions { justify-content: flex-start } — NEVER flex-end. flex-START = LEFT. auditTemplate.mjs fails on flex-end.
⭐⭐ NO ORPHAN ROWS (UNIVERSAL) + SPLITTING IS PER-TEMPLATE (JUDGMENT) — STANDING user directives July 9 2026, memories 6a4f7b87 + 6a4bc9b9 + 6a4aab16 + 6a4f7794. (A) NO BARE ROWS [UNIVERSAL — apply on EVERY template]: when a section/field mixes labeled sentences (rec-mini-card + nested-subtitle) with loose UNLABELED rows, the loose rows MUST ALSO be wrapped in a rec-mini-card (WITHOUT a subtitle) so every row shares the boxed look & feel; renderStringField's regular-sentence-row = className="rec-mini-card" ALWAYS (never `parsed.isLabeled ? 'rec-mini-card' : ''`). VERIFY by DOM-probe: [...host.querySelectorAll('.numbered-row')].filter(r=>!r.closest('.rec-mini-card') && !r.closest('.nested-mini-card')) MUST be empty. (B) SPLITTING = PER-TEMPLATE JUDGMENT ON THE REAL VALUES [NOT a blind global transform — user July 9 2026: "the split we are working per template basis"; the USER is the arbiter, memory 6a4bc9b9]: INSPECT each field's ACTUAL value and split into one row per clause/item ONLY when it is a genuine list / multi-clause narrative — sentence [.;] then guarded-comma (labeled always; unlabeled ≥2-3 by shape); object-leaf values with ';' → per-clause rows (renderObjectLeaf clauses=splitBySentence(leaf), >1 → row per clause, save rejoins '; '); comma-list descriptive fields → COMMA_FIELDS + renderCommaField. KEEP WHOLE: grammatical 2-part appositives ('Alcohol Use Disorder, Severe'), credentials ('X, MD, FACE'), addresses, ranges/dates. This user LEANS toward MORE splitting (every user-caught miss is UNDER-splitting), so when a value IS a list/multi-clause, split it up front + mirror JSX/Copy/PDF + RENDER-AND-SHOW the result — but decide PER field/template on the data, do NOT force-split everything mechanically.
When asked to fix ONE thing in a template, proactively AUDIT + FIX ALL of these in the SAME pass
(user-confirmed July 2026 across CareCoordination / CareCoordinationNotes / CaregiverAssessment):
1. 4-AREA MIRROR: JSX nested-subtitle mini-cards = Copy Section = Copy All = PDF. NEVER side-by-side "Label: value" — this means IN THE JSX DOM TOO, not just Copy: an OBJECT-ARRAY sub-field (a medication's "Dosage: 1000mg", an AED's "Dose: ...") must render its label as a `nested-subtitle sub-label` ABOVE a value-only row, NEVER as a `.content-label` span inline with the value (FamilyMedicineVisits medications, user-caught July 9 2026 — the old audit only scanned the Copy-All string + FIELD_LABELS labels so it slipped through; auditTemplate.mjs now has a DOM check "JSX no side-by-side Label: value row" that flags any `.content-label` span or inline "Label: value" .content-value; memory 6a4e4e51). ⛔ MINI-CARD PRIMARY-FIELD DOUBLE (ClinicalDecisionSupport July 3 2026, user-caught): the field used as an item's nested-subtitle HEADER (its identity — factor/finding/medication) MUST NOT ALSO be a labeled editable row = the same value prints twice (subtitle + a "Factor" row). Render the primary ONCE as the subtitle; only SECONDARY attributes become rows (drugInteractions' meds-header pattern). Mirror in all 4 areas — Copy/PDF use header + secondary, never the primary as its own "1. value" row. AUDIT every array-of-objects mini-card: if the header field also appears in the rows, delete that row (memory 6a4746da).
2. COPY DIVIDERS: '='.repeat(40) under section titles (+ record title in Copy All); '-'.repeat(40) under every field sub-label / object key.
3. NUMBERING: Copy + PDF number EVERY value row ("1." even for single values). JSX rows stay unnumbered. Copy All empty-section guard must count >2 non-empty lines (title + divider). ⭐ Grouped lists: numbering RESTARTS only at each LABELED group; an UNLABELED group CONTINUES the running count (restart with no header reads as duplicate "1.").
4. SINGLE-NAME RULE: field label == section title (case-insensitive) → hide the label in ALL 4 areas, including copy. ⛔ TRIPLE HEADER (DiabetesSupplies July 5 2026, user-caught): the compare must NORMALIZE AWAY a trailing parenthetical acronym on the section title — label 'Continuous Glucose Monitor' under title 'Continuous Glucose Monitor (CGM)' IS single-name (strip /\s*\([^)]*\)\s*$/ before comparing). Also: a field label that REPEATS its section title as a prefix stacks into a triple header ('Insulin Pump' → 'Insulin Pump Reservoir' → value) — shorten the label to the distinguishing remainder ('Reservoir', 'Sensor Quantity', 'Transmitter Included') in FIELD_LABELS AND the PDF spec. ⭐ COLON-LABELED VALUE = 3RD-LEVEL SUBTITLE (DiabetesSupplies July 5 2026, user-requested): a stored value 'Tandem t:slim X2' renders as sub-label 'Tandem t' + row 'slim X2' in ALL 4 areas (JSX nested-mini-card, Copy Section/All 'Label\nDASH\nLabel2\nDASH\n1. value', PDF extra fieldLabel) — parseColonValue captures the separator (colon + spacing) EXACTLY so editing the remainder rebuilds `label+sep+new` byte-identical; the editor seeds the REMAINDER only, never the whole string.
5. FIELD_LABELS COMPLETE: every field needs an entry — a missing one leaks raw camelCase into the PDF AND silently drops its values from Level-1 search.
6. LABEL:VALUE PARSING: array items → parseLabel → nested-mini-card, sub-label once per consecutive same-label group. ⛔ ARRAY ITEMS ALSO COMMA-SPLIT (recurring miss — ChiropracticConsultation contraindications was one array element holding a comma-list of findings, left un-split): guarded splitByComma each item, but ONLY when it yields >=3 parts (a genuine list) — below 3 the comma is grammatical dosing ("exercise, twice daily") so keep the item whole (Rule #73). ⛔ OBJECT-VALUE ARRAYS (a nested-object field whose VALUE is an array, e.g. disease.medications) must render as a sub-label + one numbered row per item in ALL 4 areas — NEVER fmtVal(array) which prints a comma-joined BLOB (ChronicDiseaseManagement arthritis.medications, July 2026). ⛔ ARRAY FIELD REACHING A SCALAR FALLBACK RENDERER (DevelopmentalMilestones concerns/referrals, July 5 2026): a field missing from every *_FIELDS dispatch list falls to renderEditableField which displays String(array) as a comma-joined BLOB and — worse — SAVING writes a STRING over the array (data corruption on Approve). AUDIT: diff every SECTION_FIELDS field against the dispatch branches in renderSection; any array-typed field hitting the fallback needs a per-item string-array renderer (splice + stage the ARRAY). ⛔ RECURSIVE renderObjectNode/objectCopyLines/PDF renderObjectNode that fall through to Object.entries(value) on an ARRAY render its INDEXES as labels — humanizeKey('0')='0' → sub-labels "0","1","2" in JSX+Copy+PDF (DermatologyAssessment prerequisites/imagesObtained, July 5 2026, memory 6a49cf53): every recursive object renderer needs an Array.isArray branch FIRST (numbered rows, per-item editing via array-splice save). Narrative list items (managementPlans/recommendations style — each item a full instruction) stay WHOLE, no >=3 split. ⛔ SINGLE-SENTENCE COMMA BLOB (DiabetesManagementPlan `plan`, July 5 2026): a NARRATIVE field that is ONE sentence with >=3 guarded comma parts never reaches the multi-sentence comma branch when the renderer/copy gate on `sentences.length > 1` — the PDF splits it while JSX+copy show a blob (4-area asymmetry). Gate the rich path on NARRATIVE_FIELDS membership (labeled OR >=3 single-sentence parts OR multi-sentence), and EXCLUDE credential strings (provider 'X, MD, FACE') from that list so they never comma-split. ⛔ DYNAMIC KEY→VALUE OBJECT FIELDS (clinical_scores `other`/`results`, July 3 2026 "empty titles with no data"): values may be SCALARS — a renderer that only supports nested objects nulls every child while a key-count section gate keeps the TITLE visible = empty section title + bare keys in copy. Rules: value-shape-agnostic rendering (number→stepper, string→row / >=3 comma parts→numbered part rows, object→subtitle+prop rows); gate the section on hasVal(VALUES) never Object.keys().length; humanizeKey every dynamic key; ALSO grep for schema fields rendered NOWHERE (type/results were silently dropped). Memory 6a474d3c. Mirror the >=3 split in ALL 4 areas (JSX renderEditableArrayItem with per-part saveArrayPart, Copy Section, Copy All, PDF). Then sentence-string fields: sentence fields → splitBySentence THEN splitByComma on ALL sentences, labeled AND unlabeled (guards: paren-aware; keep "and"/"or" on either side of the comma together; skip commas with no following space, e.g. "$18,000"). ⛔ splitBySentence MUST use the abbreviation+decimal guard — `/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/` — NEVER the naive `[;.]\s+` (it breaks "3.5 months vs. standard therapy" and "Dr. Smith"; recurring bug — grep every template's splitBySentence when you touch it, JSX AND PDF). ⛔ EXCEPTION — SEMICOLONS INSIDE LABELED GROUPS (DevelopmentalAssessments, July 5 2026): when a field's structure is 'Label: a; b; c. Label2: x; y.' (semicolons separate ITEMS inside period-separated labeled groups), keep the sentence split PERIOD-ONLY and split the labeled VALUE semicolon-first (>=2 → rows, else comma >=3) — applying [.;] there breaks each semicolon item into its own unlabeled sentence and DESTROYS the grouping. Save must rejoin with the ORIGINAL delimiter (splitLabeledValue returns {items, sep}). ⛔ WHOLE-FIELD SEMICOLON LISTS TOO (DiabetesEducation plan, July 5 2026): a field that is one flat 'a; b; c' list gets split into rows by [.;] but a naive reconstructFullText rejoins with PERIODS = silent delimiter corruption on save — make reconstruction delimiter-aware (originalText.includes(';') && !/\.\s/ → rejoin '; '). INSPECT the real value before choosing. ⛔ parseLabeledSentences (memory 6a46180d) is the DEFAULT — before using a flat sentence×comma split, INSPECT the real field values: ANY sentence matching the label rule (colon 1..60, no '.' in label) REQUIRES the labeled-group pattern (nested-subtitle GROUP + comma rows + (si,ci) edit keys; save rebuilds `label: parts.join(', ')`); trailing [.;] stripped. Header provider/people fields ("Dr. X, MD (role), Nurse Y, RN (role)") → split AFTER ')' — /(?<=\)),\s+/ — or by semicolon; per-part edits rejoin with the original delimiter. ⛔ COMMA-SPLIT-FIRST WHEN THE COLON FOLLOWS A COMMA (DialysisPlanning July 5 2026, 6 user round-trips, memory 6a4a2829): parseLabel on the WHOLE sentence grabs a comma-spanning giant label — instead comma-split the sentence FIRST then parseLabel EACH part (part with a colon → sub-label + value row; else plain row). parseLabel's label class must EXCLUDE comma + allow clinical chars <>~%+= + cap 120: /^([A-Za-z][A-Za-z0-9\s/&().#'"%<>~+=-]{1,120}?):\s+([\s\S]+)$/ (requires a non-empty value). ⛔ HEADER-COLON OWNS A MINI-CARD (memory 697ba540): a sentence ENDING with ':' (a list lead-in like "Pre-Dialysis Planning ...:") is a GROUP HEADER → render it as a sub-label that WRAPS the following plain rows in ONE nested-mini-card (build a `cards` list in the renderer; an openHeader collects following plain rows until the next header/labeled clause); a labeled clause is its OWN card; plain rows with no open header render bare. ⛔ SOURCE-NUMBER STRIP: splitBySentence on a field with >=2 " N. " enumerators → split /(?:^|\s)\d+\.\s+/ DROPPING the numbers (JSX stays unnumbered; keeping them makes copy double-number "2. 1."). ⛔ SUB-LABEL IN COPY = blank line before it + the label + '-'.repeat(40) divider + numbering RESTART (item 3); PDF subLabel style gets a 0.5pt #999 bottom rule + marginTop ~10. ⛔ EPOCH-DATE SENTINEL: a date "1970-01-01" → formatDate returns '' (getUTCFullYear()<=1970 && month 0 && date 1) so it hides in all 4 areas. ⛔ DROPPED NESTED FIELD: grep the REAL record's nested-object keys vs SECTION_FIELDS — a stored key absent from the dispatch lists is invisible everywhere. ⛔⛔ META: RENDER-AND-READ the actual DOM structure + Copy-All text before claiming a sentence field is done (all 6 bugs were invisible in the source, obvious in the render); and a stdout "dump" script does NOT rewrite copyall-*.txt — only the verify harness (which clicks Copy All) does, so don't confirm a fix against a stale file.
7. APPROVE: every editable field's sid MUST exist in SECTION_FIELDS (header DATE is the classic orphan); renderApproveButton acts on the RENDERED record (never records[idx] — wrong record under search); approving state disables the button; .approve-btn has margin-top + capitalize; yellow pending / green approved.
8. EDIT WIDGETS: fixed-choice strings → ENUM_FIELDS rendered with the custom BlueSelect (import '../components/BlueSelect'; <BlueSelect value={editValue} options={options} onChange={v=>setEditValue(v)} />) — ⛔ NEVER a native <select>: its popup is unstylable OS chrome that opens RTL/right on a Hebrew OS and direction:ltr can't move it (memory 6a4aaa32). ⭐ RTL: also force `direction: ltr; text-align: left` on the template root + `<root> * { direction: ltr }` so rows/BlueDatePicker/steppers don't flip (memory 6a4aa8a8). ⛔ a `status` field is ALWAYS a fixed-choice enum (Active / Not Active): GREP every status/active/state string field and wire renderEnumField (missed on ChronicDiseaseManagement — status rendered as a free-text textarea; user caught it). Keep an unmatched current value as an extra option (enumOptionsWith) so a descriptive status like "Active management with PAP enrollment" is never lost; seed editValue to the canonical option when the current value matches case-insensitively. ⭐ ACT LIKE A MEDICAL PROFESSIONAL (STANDING user directive July 4 2026, memory 6a4908b2): READ each field's VALUE — when it is a KNOWN CLINICAL SCALE, offer the FULL scale as the dropdown: dementia staging Mild/Moderate/Severe; fall risk Low/Moderate/High; advance directive Complete/In Progress/Not Started/Declined; caregiver type Spouse/Adult Child/Other Family/Friend or Neighbor/Professional/None; respite care None/Occasional/Regular/Urgent; nutrition (MNA) Well-Nourished/At Risk of Malnutrition/Malnourished; dementia etiology Alzheimer's/Vascular/Lewy Body/Frontotemporal/Mixed/Parkinson's Disease Dementia; CDR GLOBAL score 0/0.5/1/2/3 in BOTH storage variants — string "1.0 (Mild Dementia)" (DementiaAssessment) AND bare NUMBER (DementiaEducation, save via Number() so the stored type is preserved). CONTINUOUS clinical scores (MMSE/MoCA/NPI/ADL/IADL/Zarit, CDR Sum of Boxes, GCS, dental indices, implant metrics) are NEVER enums → −/+ stepper; bar-chart score editors are a number surface too (grep every type="number" incl. chart value editors). ⛔ CLINICAL-SCALE CATALOG lives in memory 6a4908b2 (Lekholm-Zarb bone quality Type1-4 / quantity A-E, SAC Straightforward/Advanced/Complex — TRUST THE VALUE OVER THE FIELD NAME: 'schwartzImplantSurgeryIndex' held the SAC value 'Advanced'; Dean's fluorosis, Angle occlusion, ADA caries risk, Jemt papilla, NYHA, Fazekas, Bethesda). ⛔ NUMERIC VALUE STORED AS A STRING IS EASY TO MISS FOR THE STEPPER (user-caught July 4 2026, DentalImplantSurgery implantPositionFDI = the string "8", a tooth number left as free-text because "(FDI)" reads categorical): grep each template's NON-enum text fields against the REAL record — any value matching /^-?\d+(\.\d+)?$/ that isn't already a NUMBER_FIELD is a stepper candidate (add to NUMBER_FIELDS; handleSaveField coerces to Number). ⛔ CLAMP DIRECTION + HIDE-ZERO ARE PER-FIELD SEMANTICS, NOT GLOBAL: overjet/overbite go NEGATIVE (anterior crossbite) → don't clamp to 0; implant dims can't → clamp ≥0. salivaryFlowRate 0 is MEANINGFUL (xerostomia) → show; implant torque/ISQ/HU/PES 0 = NOT MEASURED (ISQ 0 impossible) → hide (mirror hide-zero in Copy+PDF). Read the metric to decide. Unsure of the scale → ask the user or leave textarea. ⛔ NO COLORED VALUE BADGE/PILL/TAG CHIPS (STANDING user pref July 4 2026, memory 6a4918a3): a FIELD'S VALUE is ALWAYS plain text in a normal row (<span className="content-value">), NEVER a colored `.X-badge`/`.array-tag`/`.chip`/`.pill` (boolean-badge yes/no, risk-badge, severity-badge, array-item chips) — GREP each template for `-badge`/`array-tag`/`chip`/`pill` on VALUES and convert to content-value rows (array items → one plain numbered row each); delete the dead CSS; drop decorative suffixes ("- RISK"). ALLOWED (not value-tags): .date-badge (record timestamp), .record-status pill, .modified-badge, .approve-btn Pending/Approved, bar-chart interpretation labels. numbers → −/+ stepper. ⛔ STEPPER STEP = THE VALUE'S OWN PRECISION, NEVER A FIXED MEASUREMENT INCREMENT (STANDING user directive July 5 2026, memory 6a4a3fae): step = decimal-aware stepFor(v) [integer→1, 0.1-value→0.1, 0.01-value→0.01]; the customer TYPES the exact value. ⛔ BANNED: a per-field STEP_FOR map (heparin +500, time +5, flow +50 confused the customer — reverted across the 4 dialysis templates) UNLESS MEDICALLY CERTAIN the increment is the standard reporting unit (HbA1c 0.1, ABI 0.01, BMD 0.01, LDL 1 — allowed, they equal the value precision anyway). Grep every stepper for a STEP_FOR map or `dir * <constant≥2>` and replace with stepFor(prev). ⛔ numeric ARRAY ELEMENTS too (CompressionTherapy limbCircumferenceMeasurements, user-caught July 3 2026): in renderArrayField branch on typeof item === 'number' BEFORE parseLabel/comma-split → stepper editor row, save via saveArrayNumberItem staging a NUMBER (never editValue.trim() — that string-ifies the element in the DB on Approve; memory 6a479b59); number+unit/percent strings ("174 mg/dL", "7.5%") → stepper PER NUMBER with units preserved verbatim (parseNumeric {nums,literals} + rebuild; gate by an EXPLICIT field list, never value-shape detection — it catches dates like "February 3-9, 2026"); dates → BlueDatePicker. ⛔ DATE-VALUED FIELD LEFT IN STRING_FIELDS RENDERS RAW ISO (DiabetesEducation dateProvided, July 5 2026): grep every string field's REAL values for /^\d{4}-\d{2}-\d{2}T/ — any hit belongs in DATE_FIELDS (formatDate + BlueDatePicker in all 4 areas), else the row shows '2026-02-10T00:00:00.000Z'. ⛔ TIME (not date) FIELDS → BlueTimePicker (STANDING user directive July 4 2026, memory 6a48b0d6): a field/leaf that is a DURATION or TIME-OF-DAY (not a calendar date) uses the themed clock picker, NOT the number stepper — import '../components/BlueTimePicker'; <BlueTimePicker value={'HH:mm'} onChange={hm=>setEditValue(hm)} />; object-leaf pattern = TIME_FIELDS + parseToHM('4 hours (240 minutes)'→'04:00') + an `isTime` branch computed BEFORE ratio/nu so it SUPPRESSES the −/+ stepper; CLARIFY (AskUserQuestion) the SAVE format when the value carries descriptive text ('4 hours (240 minutes)' → plain 'HH:mm' vs preserve-annotation) before wiring save. ⭐ BlueTimePicker was REBUILT July 6 2026 (memory 6a476708, user: 'great time picker') into a COMPACT SINGLE-ROW control — [−] HH [+] : [−] MM [+]  [AM|PM segmented toggle]  Now, ~52px tall, width:100% fills the row (justify-content:space-between, flex-wrap), −/+ buttons + AM/PM toggle match the blue-glow theme; the HH/MM cells ARE the display (no separate big time line / title / footer). It is the SHARED canonical time picker — USE IT AS-IS on every template (API unchanged: value 'HH:mm' / onChange(hhmm)); NEVER rebuild a per-template time UI, and swap any native <input type=\"time\"> or bespoke clock control you find to this shared component. A time field just needs TIME_FIELDS + <BlueTimePicker/> — the good design comes for free. ⛔ MONTH-GRANULARITY DATE FIELDS → BlueMonthPicker (STANDING user directive July 4 2026, memory 6a48b823): a date field that is MONTH+YEAR with NO day ('January 2026' — EDD/LMP) uses the themed month picker (components/BlueMonthPicker.jsx, year stepper + 12-month grid), NOT BlueDatePicker (forces a day) nor a textarea — MONTH_FIELDS=['edd','lmp'] + a MONTH branch in renderEditableField, stores 'Month YYYY'. ⛔ CYP450 STAR-ALLELE DIPLOTYPE fields ('*A/*B' ± 'xN' copy-number, e.g. '*1/*1x3','*2/*2') → BlueDiplotypePicker (components/BlueDiplotypePicker.jsx, 2 star-allele dropdowns + per-allele −/+ copy-number stepper, composes '*A/*B(xN)'; memory 6a48c85b): gate by an EXPLICIT DIPLOTYPE_FIELDS list of PURE star-allele genes — rs-notation genotypes (VKORC1 '-1639G>A', SLCO1B1 '521T>C') and phenotype-sentence status fields are NOT diplotypes and stay TEXT. ⛔ PHONE-NUMBER fields/leaves ('(602) 555-0482'; officePhone/afterHoursPhone/emergencyContacts.phone) → BluePhonePicker (components/BluePhonePicker.jsx, 3 segmented numeric inputs area/prefix/line composing '(AAA) PPP-LLLL'; memory 6a4cbf9a): gate by an EXPLICIT PHONE_FIELDS leaf-key list (not value-shape); wire the object-leaf editCell (isPhone branch) AND a top-level renderPhoneField dispatched before DATE; EDIT-WIDGET-ONLY (stored string unchanged → Copy/PDF/backend untouched). verifyTemplateWidgets.mjs FLAGS a phone-shaped value (strict 3-3-4) left in a textarea. ⛔ NUMBER+UNIT/PERCENTAGE VALUE → −/+ stepper EVEN INSIDE A LABELED ARRAY ITEM ('Recurrence risk...: 70%'): splitMeasurement(parsed.content) via STRICT MEAS_RE=/^-?\d+(?:\.\d+)?\s*(?:%|[A-Za-z]{1,6}(?:\/[A-Za-z]{1,6})?)$/ (unit REQUIRED so years/ranges/word-dates excluded) → stepper editing the number, unit preserved, save rebuilds `label: N unit` (memory 6a48b823). ⛔ SPACING (two distinct, both user-caught, memory 6a48b823): (a) SECTION TITLE vs container top — don't leave .mini-cards-container at a flat 16px, use padding: 24px 18px 18px 18px; (b) FIELD LABELS vs the row above — if renderEditableField wraps each field in a BARE <div key={fn}> with no class/margin (vs good templates' <div className={sl?'rec-mini-card':''}> whose .rec-mini-card has margin-bottom), labels cram against the previous value row; fix CSS-only with `.<doc> .mini-cards-container > div + div { margin-top: 16px; }` (excludes the first-child section-header). ⭐ EDIT WIDTH: widgets fill the row — .edit-field-container { flex: 1 1 100% }, no fixed pixel widths on inputs (memory 6a451881). ⛔ DOUBLE NUMBER PICKER (user-caught July 5 2026, DexaScanReports screenshot): the stepper's <input type=number> still shows the BROWSER'S native spin arrows inside the field next to −/+ unless CSS hides them — every .edit-number needs `-moz-appearance: textfield; appearance: textfield;` PLUS `.edit-number::-webkit-outer-spin-button, .edit-number::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }` (donor: DentalImplantSurgeryDocument.css). When porting stepper CSS, copy ALL the rules: .num-stepper-row / .num-step / .num-step:hover / .edit-number WITH the spin-button reset — DevelopmentalMilestones+DexaScanReports both inherited the miss from an incomplete donor. ⛔⛔ 2ND OFFENSE variant (DiabeticFootAssessment July 5 2026): many older CSS files carried `::-webkit-inner/outer-spin-button { opacity: 1 }` — the arrows were FORCED visible, and a presence-check patcher skips the file because the selector already exists. CHECK THE RULE'S CONTENT: it must be `-webkit-appearance: none; margin: 0` (repo-wide sweep fixed 331 files in commit 279511adc; verify on touch anyway). Stored value type unchanged so Copy/PDF stay untouched. ⛔ BACKEND ALLOWLIST GATES EDITABILITY (DepressionScreening July 4 2026, memory 6a4908b2): a field may be READ-ONLY only because its parentField is missing from routes/edit/<collection>.js `ALLOWED_FIELDS` (the /:id/edit route 400s "not editable") — NOT a frontend choice. When you convert a read-only field to an edit widget, GREP that route's ALLOWED_FIELDS and ADD the field, else Save silently 400s. If the template uses a BESPOKE section-approve/editedSentences arch (textarea-only editValue, string-only handleSaveField) instead of the shared renderEditableField, add a renderWidgetField that reuses the same editKey/handleStartEdit and make handleSaveField COERCE by field type (BOOLEAN_FIELDS 'Yes'/'No'→bool; NUMBER_FIELDS →Number()). ⛔ 0/false ARE REAL VALUES: a widget's display guard must be `raw===undefined||raw===null||raw===''` (NOT `!raw`), else a legit count of 0 (priorDepressionEpisodes) or a false boolean disappears. ⛔ BOOLEAN_FIELDS LIST vs DESCRIPTIVE STRING VALUES (DiabetesQualityMetrics July 5 2026): fields NAMED like booleans (xControlled/xPresent/xPrescribed/xCompleted) often STORE descriptive strings ('Not at target (<7.0%)', 'mild NPDR', 'Not prescribed - lifestyle modification first') — a Yes/No <select> editor OVERWRITES the string with a boolean on save (data corruption). Gate the Yes/No renderer on `typeof value === 'boolean'`; non-boolean values fall back to free-text. GREP every BOOLEAN_FIELDS entry against the REAL record values before trusting the list. ⛔ FLEX COLUMN AXIS SWAP + HIDDEN-INDICATOR SPACE (DepressionScreening July 4 2026, 4 user round-trips, memory 6a492b39): "center the row value" means VERTICAL middle + keep LEFT — never text-align:center. .row-content.editable is often flex-direction:COLUMN (value + EDIT tag stacked) where the axes swap (align-items=horizontal, justify-content=vertical): adding align-items:center to the BASE rule centers values HORIZONTALLY on every editable row. ⛔⛔ SECOND TRAP: the hover .edit-indicator ships opacity:0 — it's INVISIBLE but still OCCUPIES LAYOUT SPACE, reserving a line below the value so the text rides the top EVEN WHEN justify-content:center is applied (check the computed styles: if the property IS there yet layout is wrong, look for invisible siblings). FIX: .edit-indicator { position:absolute; right:10px; top:50%; transform:translateY(-50%); pointer-events:none } — zero layout space, row hugs the text. Recipe: .numbered-row align-items:center; base .row-content flex + align-items:center + justify-content:flex-start; .row-content.editable align-items:flex-start + justify-content:center + gap 0; edit-indicator absolute; @media column .numbered-row align-items:stretch. Debug: grep ALL matching rules incl. variants (.editable/.modified/:hover) + @media before editing the base rule; row too tall → compact the row .copy-btn (4px 10px/11px) + row padding 7px 12px.
9. PDF POLISH: 0.5pt #999999 underline under field sub-labels (section titles keep the heavier 1pt black rule); Rule #74 wrap gating intact; B&W only. ⭐ RULE #75 — MULTI-RECORD NEW PAGE: in the records.map record loop, the per-record container View MUST have `break={idx > 0}` so every record after the first STARTS ON A NEW PAGE (react-pdf break = page-break-before); NEVER on record 0 (blank first page). Missed on ChronicDiseaseManagement (record 2 "Chronic Disease Management 2" flowed mid-page — user caught it). Verify by rendering a 2-record patient: record 2's title must be the first content on its page. Memory 6a3bbf51. ⛔ react-pdf 4.5.1 (July 2 2026): wrap conditionals MUST pass booleans — `wrap={rows > 8 ? true : false}`; an explicit `wrap={undefined}` makes the View UNBREAKABLE. Record/container wrapper Views: paddingBottom only, NEVER marginBottom (marginBottom shoves the whole record to the next page → empty first page with only the title). ⛔ ANTI-ORPHAN: gate per FIELD (never a section-level gate with the title as a bare sibling — title orphans); sectionTitle rides INSIDE the first field's View; every inner label+value LEAF is its own small wrap={false} glue unit (sub-labels orphan too); ⭐ a SINGLE narrative field + its section title fits one page — keep that first-field unit wrap={false} up to ~22 rows, NOT the >8 list threshold (adding +1 for the title tips a ~7-row field over >8 → the unit wraps → the title orphans; the >8 boolean is for how LONG content spans pages, not for a one-field+title glue unit); verify by scanning the LAST text run of every rendered page for an all-caps label — but a hyphenated/uppercase VALUE like "T11-T12"/"NO" is a false positive, only a section TITLE or field LABEL at page end is a real orphan (memory 6a2d6af6).
10. HEADER: no duplicate date/provider meta pills in the record header when that data already has its own section. Also grep render call sites for a field passed BOTH explicitly and via spread — ['date', ...SECTION_FIELDS.x] where 'date' is already in the array renders the row TWICE (CgmData triple-date).
11. TITLES + ROUTING: PDF documentTitle + fileName == JSX document-title exactly; check pdf-templates/index.js for a SECOND legacy generic fragment mapped to this collection (emoji titles / stale schema) and flag it.
VERIFY: esbuild both files + node-simulate the copy output against the REAL patient document (mongosh), not invented data. ⛔ TDZ DEP-ARRAY CRASH (DermatologyProcedureNotes, USER-HIT live, July 5 2026, memory 6a49...): a useCallback/useMemo DEPENDENCY ARRAY referencing a const declared LATER in the component body throws 'Cannot access X before initialization' on EVERY render — esbuild passes it, only rendering catches it. GREP each hook's dep array identifiers against declaration ORDER when touching a template; jsdom-render the template in the harness before shipping. If the user reports a PDF "still broken" right after a fix: PROVE the on-disk file first (render + extract fonts/page text from the bytes) — if correct, it's a STALE browser build/old download → hard refresh + check the downloaded fileName (Underscore_Name.pdf rename = freshness marker); memory 6a4626b2.
⛔⛔ ONE-PASS COMPLETENESS — EDIT-PROBE EVERY WIDGET BEFORE DECLARING DONE (DoctorsMedicationRecommendations July 5 2026, memory 6a4aab16): I keep shipping a PARTIAL one-pass and the user catches the skipped widgets ONE BY ONE — this session BlueDatePicker + dosage number+unit stepper + indication comma-split were EACH skipped then user-caught in 3 separate rounds. RULE: GREP the REAL record's field VALUES and wire the widget the VALUE demands, then click-probe each in the harness (assert the right widget mounted): date-shaped (ISO / 'YYYY-MM-DD' / day) → BlueDatePicker; bare-number or number+unit string ("100 mg") → −/+ stepper; fixed-choice → BlueSelect; narrative with an internal ';' or ',' → sentence→semicolon→guarded-comma LEAF split (DEFAULT SPLIT — threshold 2 for distinct clinical clauses; THIS user wants aggressive comma/semicolon splitting on narrative fields, memory 6a4a4cd5). Do NOT say "full one-pass done" until every field's widget is applied AND edit-probed. ⭐ RUN THE COMMITTED HARNESS (mechanical proof, not a promise): fetch the REAL record via the Mongo MCP → a JSON file, then `cd apps/frontend-vite && node scripts/verifyTemplateWidgets.mjs <TemplateName> <record.json>` — it renders the template, CLICKS every editable field, and EXITS 1 on any numeric-value-in-textarea / bare-number-input / native-<select> / native-<input type=date> / date-value-in-textarea mismatch. A GREEN widget run (exit 0) is NECESSARY BUT NOT SUFFICIENT — it ONLY covers item 8 (edit WIDGETS), NOT the approve button, copy dividers, PDF, or CSS. ⛔⛔ THE REAL ONE-PASS GATE IS: cd apps/frontend-vite && node scripts/auditTemplate.mjs <TemplateName> <record.json> (added July 6 2026 after EcgReports shipped a wrong "Approve" button + missing PDF underline lines + a too-narrow stepper that the widget harness could not see, and the user caught them one by one). It runs the WHOLE 11-item checklist STATICALLY (grep JSX/CSS/PDF) + DYNAMICALLY (renders Copy All + the PDF): approve-button standard (Pending Approve text / .pending yellow #eab308 / .approved green #22c55e / header-right-actions column BELOW Copy Section / text-transform capitalize / badge "edited - click Pending Approve to save"), copy EQ/DASH dividers + NO side-by-side "Label: value", PDF box-free underline rules (documentTitle 2pt / sectionTitle 1pt black / fieldLabel 0.5pt #999 borderBottom), titles/fileName Underscore_Name.pdf, RTL direction:ltr root+*, enum dup-guard (case-insensitive enumOptionsWith), and it re-runs verifyTemplateWidgets asserting >0 fields probed (catches the vacuous "0 scalar fields probed" green on Feb-2026 bespoke rows). auditTemplate.mjs exit 0 (EVERY check green) is REQUIRED before declaring a one-pass done — the widget harness is just its item-8 sub-check. enum dropdown option lists are still eyeballed (judgment calls).
EOF
)
    # Active detection: writing a native date input into a template is banned (July 2 2026).
    NEW_CONTENT="$(json_field tool_input.new_string toolInput.new_string)$(json_field tool_input.content toolInput.content toolInput.string_to_replace)"
    if printf '%s' "$NEW_CONTENT" | grep -q 'type="date"'; then
      MSG="⛔ NATIVE DATE INPUT IN THIS EDIT: you are writing <input type=\"date\"> into a template. Its popup calendar is unstylable OS chrome and is BANNED — use BlueDatePicker instead (import from '../components/BlueDatePicker'; <BlueDatePicker value={editValue} onSelect={(iso) => setEditValue(iso)} />; full pattern: memory 6a45f257).

$MSG"
    fi
    if printf '%s' "$NEW_CONTENT" | grep -Eq '<select[ >]|edit-select'; then
      MSG="⛔ NATIVE <select> IN THIS EDIT: you are writing a native <select> into a template. Its dropdown popup is unstylable OS chrome (an NSMenu on macOS) that IGNORES CSS 'direction' — on an RTL OS (the user runs Hebrew macOS) the option list opens RIGHT/RTL and CANNOT be moved with direction:ltr. BANNED — use the custom BlueSelect instead (import from '../components/BlueSelect'; <BlueSelect value={editValue} options={options} onChange={(v) => setEditValue(v)} />; div/ul list we render, always LTR/left; full pattern: memory 6a4aaa32). ALSO force LTR on the template root so rows/pickers don't flip: <root> { direction: ltr; text-align: left; } + <root> * { direction: ltr; } (memory 6a4aa8a8).

$MSG"
    fi
    emit_context "$MSG"
    exit 0
  fi

  # ─── intellicare-mobile app files → RELOAD-THE-APP reminder (user standing rule, July 7 2026) ───
  if [[ "$FILE_PATH" == */intellicare-mobile/* ]]; then
    MSG=$(cat <<'EOF'
📱 INTELLICARE-MOBILE EDIT — RELOAD THE APP AFTER THIS CHANGE (user standing rule, July 7 2026; MCP memory 6a4cbb91c395335e413c2a24)
Metro's bundler cache can wedge and SILENTLY keep serving OLD JS, so a correct fix looks like it "does nothing" (backend logs show the request succeed while the UI stays stale — this cost 3 wasted round-trips on the chat-search fix). Before telling the user a mobile change works, RELOAD the running app and verify it actually took effect:
  1) Relaunch: xcrun simctl terminate <bootedId> com.intellicare.mobile && xcrun simctl launch <bootedId> com.intellicare.mobile   (booted id: xcrun simctl list devices booted)
  2) Still not visible? Metro cache is stale → kill Metro, restart 'npx expo start --port 8081 --clear', then relaunch.
  3) Native-module change (new expo-* package, e.g. expo-audio) → full 'npx expo run:ios' rebuild; a JS reload is NOT enough.
Do NOT claim a mobile fix works until the running app has loaded the new code.
EOF
)
    emit_context "$MSG"
    exit 0
  fi

  MSG=$(cat <<EOF
⚠️ PRE-TOOL VALIDATION - CODE MODIFICATION DETECTED

You are about to modify code using the ${TOOL_NAME} tool.

🔍 REQUIRED VERIFICATION CHECKLIST:

Before proceeding with code modification, verify you have:

✅ Searched MCP memories for relevant patterns/standards
   → Did you call search_memories with relevant keywords?
   → Did you recall IntelliCare category memories (standard/warning/pattern)?

✅ Checked existing implementation patterns
   → Are you following existing code patterns in this codebase?
   → Have you reviewed similar files for consistency?

✅ Validated this change follows project standards
   → Does this match the coding style?
   → Are you using the correct libraries/patterns?

🚨 PRE-MODIFICATION GATE CHECK (You MUST answer in your response):

Q: Did you search MCP memories before this code modification?
   Your answer → "✅ SEARCHED: [X] memories found"
              OR "⚠️ NO SEARCH: Proceeding without memory check"

⚠️ ENFORCEMENT RULE:
   → You MUST show one of the two answers above in your response
   → To answer "SEARCHED", you must have executed search_memories first
   → Be honest - if you didn't search, say "NO SEARCH"
EOF
)
  emit_context "$MSG"
  exit 0
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# VALIDATION #2: Git Commit Operations
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [[ "$TOOL_NAME" == "Bash" ]] || [[ "$TOOL_NAME" == "run_terminal_command" ]]; then
  # Note: must not be named BASH_COMMAND - that is a reserved bash variable
  RUN_COMMAND=$(json_field tool_input.command toolInput.command)

  if echo "$RUN_COMMAND" | grep -q "git commit"; then
    # ── HARD GATE (user-chosen July 6 2026): BLOCK the commit (exit 2) if any modified/staged template
    #    fails the STATIC one-pass audit — approve button, PDF underline rules, RTL, fileName, native
    #    controls, enum dup-guard. Record-based checks (Copy All + PDF render) remain a manual gate.
    #    Uses git status --porcelain (not --cached) because commits run as `git add X && git commit` so
    #    files aren't staged yet when this fires. FAIL-OPEN: if node/the script is absent or crashes (no
    #    ❌ lines produced) the commit is NOT blocked — a broken audit must never wedge all commits.
    CWD=$(json_field cwd)
    [ -n "$CWD" ] && cd "$CWD" 2>/dev/null
    # ── SCOPE (user directive 2026-07-07): the web-template one-pass block is INTENTIONAL and stays
    #    exactly as-is — but it must ignore the separate intellicare-mobile repo, which has no templates.
    #    A commit that targets that repo references its path (`cd .../intellicare-mobile && git commit`
    #    or `git -C .../intellicare-mobile commit`); skip the audit for it. Web commits are unaffected.
    if printf '%s' "$RUN_COMMAND" | grep -q "intellicare-mobile"; then
      : # mobile-app commit — not gated by web-template state
    elif [ -f "apps/frontend-vite/scripts/auditTemplate.mjs" ] && command -v node >/dev/null 2>&1; then
      TPL_NAMES=$(git status --porcelain 2>/dev/null \
        | grep -oE '(templates|pdf-templates)/[A-Za-z]+Document(PDFTemplate)?\.(jsx|css)' \
        | sed -E 's#.*/([A-Za-z]+Document)(PDFTemplate)?\.(jsx|css)$#\1#' \
        | sort -u)
      if [ -n "$TPL_NAMES" ]; then
        AUDIT_FAILS=""
        while IFS= read -r NM; do
          [ -z "$NM" ] && continue
          OUT=$(cd apps/frontend-vite && node scripts/auditTemplate.mjs "$NM" --static 2>&1)
          F=$(printf '%s\n' "$OUT" | grep '❌')
          [ -n "$F" ] && AUDIT_FAILS="${AUDIT_FAILS}
── ${NM} ──
${F}"
        done <<< "$TPL_NAMES"
        if [ -n "$AUDIT_FAILS" ]; then
          {
            echo "⛔ COMMIT BLOCKED — static one-pass audit FAILED for a modified/staged template:"
            echo "$AUDIT_FAILS"
            echo ""
            echo "Fix each ❌ then commit again. Full report:  cd apps/frontend-vite && node scripts/auditTemplate.mjs <TemplateName> --static"
            echo "Before declaring the one-pass done, ALSO run the record-based gate:  node scripts/auditTemplate.mjs <TemplateName> <record.json>"
          } >&2
          exit 2
        fi
      fi
    fi
    MSG=$(cat <<'EOF'
⚠️ PRE-COMMIT VALIDATION - GIT COMMIT DETECTED

You are about to create a git commit.

📋 SESSION UPDATE CHECKLIST:

Before committing, verify you have:

✅ If this was an intellicare-mobile change: RELOADED the running app + verified the fix actually
   took effect BEFORE committing (Metro cache goes stale silently — MCP memory 6a4cbb91c395335e413c2a24)

✅ Updated the current session with update_session
   → progress: "What was just accomplished"
   → decisions: [Any architectural decisions made]
   → nextSteps: [What comes next]

🧠 AUTONOMOUS MEMORY HYGIENE — DO IT YOURSELF, THE USER WILL NOT ASK (standing directive, July 2 2026).
Before EVERY commit, run a silent retrospective on THIS unit of work and act without being told:
   • NEW reusable pattern / bug root-cause / user preference / canonical value → store_memory (pattern/warning/standard) OR update the closest existing memory. Prefer UPDATE over duplicate.
   • A memory you RELIED ON was wrong, stale, or contradicted by what you just did → update_memory to correct it (keep the failed-attempt log), or delete_memory if simply false.
   • A rule you learned should fire on FUTURE template edits → also add/patch it in claude-hooks/pre-tool-use.sh (the one-pass audit block or this commit block).
   • If it was a CLEAN application of an existing memory with nothing new → that is a valid outcome; note it in the session, store nothing.
Purge contradictions so no two memories disagree. This is the same "what did we learn / update the checklist" pass the user used to request every session — now automatic.

✅ Stored important decisions in MCP memory (if applicable)
   → New patterns discovered → store_memory with category: "pattern"
   → Bugs fixed → store_memory with category: "bug" or update existing
   → Standards established → store_memory with category: "standard"

🚨 PRE-COMMIT GATE CHECK (You MUST answer BOTH in your response):

Q1: Did you call update_session before this git commit?
   Your answer → "✅ SESSION UPDATED: [confirmation]" OR "⚠️ NO UPDATE"
Q2: Did you run the autonomous memory-hygiene retrospective?
   Your answer → "✅ MEMORY HYGIENE: [stored/updated/deleted X | clean application, nothing new]"

⚠️ ENFORCEMENT RULE:
   → You MUST show both answers above in your response
   → To answer "SESSION UPDATED", you must have called update_session first
   → Be honest - if you didn't update, say "NO UPDATE"
EOF
)
    emit_context "$MSG"
    exit 0
  fi
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Default: Silent pass-through for all other tools
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

exit 0
