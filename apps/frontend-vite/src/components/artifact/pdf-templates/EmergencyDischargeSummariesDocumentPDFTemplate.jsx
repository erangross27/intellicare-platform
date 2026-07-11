import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/* Box-free B&W LETTER canonical (memory 6a2d6af6 + 6a45e766 item 9): no boxes/backgrounds — structure
   carried by horizontal underline rules (documentTitle 2pt, recordTitle/sectionTitle 1pt black,
   fieldLabel 0.5pt #999). Mirrors the JSX SECTION_FIELDS order exactly. */
const styles = StyleSheet.create({
  page: { paddingTop: 42, paddingBottom: 48, paddingHorizontal: 44, fontFamily: 'Helvetica', fontSize: 11, lineHeight: 1.4, color: '#333333', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid', marginBottom: 18 },
  recordContainer: { marginBottom: 6 },
  recordHeadWrap: {},
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid', marginBottom: 10 },
  section: { marginBottom: 10 },
  fieldGroup: { marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid', marginBottom: 8, marginTop: 6 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid', marginBottom: 4, marginTop: 6 },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#333333', marginTop: 4, marginBottom: 2 },
  listItem: { fontSize: 14, color: '#333333', marginBottom: 3, paddingLeft: 8, lineHeight: 1.35 },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
});

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const keyToLabel = (k) => String(k).replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();

// timeZone UTC: render the stored clinical wall-clock as authored (TZ-independent), matching the JSX.
const formatDateTime = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }); } catch { return String(dateValue); }
};

/* ═══ sentence rendering — mirrors the JSX splitBySentence → parseLabel → comma-split (labeled ≥2) ═══ */
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};
const parseLabel = (text) => {
  const m = String(text || '').match(/^([A-Za-z0-9][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  return m ? { isLabeled: true, label: m[1].trim(), value: m[2].trim() } : { isLabeled: false, label: '', value: text || '' };
};
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      if (text[i + 1] && text[i + 1] !== ' ') { current += ch; continue; }
      if (/^(and|or)\b/i.test(rest)) { current += ch; continue; }
      if (/\b(and|or)\s*$/i.test(current)) { current += ch; continue; }
      if (/\d\s*$/.test(current) && /^\d{4}\b/.test(rest)) { current += ch; continue; }
      const t = current.trim(); if (t) result.push(t); current = '';
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};
const sentenceRows = (text) => {
  const out = []; let n = 1;
  splitBySentence(fmtVal(text)).forEach(s => {
    const p = parseLabel(s);
    if (p.isLabeled) {
      const items = splitByComma(p.value);
      if (items.length >= 2) { out.push({ sub: true, text: safeString(p.label) }); items.forEach(it => out.push({ text: `${n++}. ${safeString(it)}` })); }
      else out.push({ text: `${n++}. ${safeString(s)}` });
    } else {
      const items = splitByComma(String(s).replace(/[;.]+$/, '').trim());
      if (items.length >= 2) items.forEach(it => out.push({ text: `${n++}. ${safeString(it)}` }));
      else out.push({ text: `${n++}. ${safeString(s)}` });
    }
  });
  return out;
};

const EmergencyDischargeSummariesDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.emergency_discharge_summaries) return Array.isArray(r.emergency_discharge_summaries) ? r.emergency_discharge_summaries : [r.emergency_discharge_summaries];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.emergency_discharge_summaries) return Array.isArray(dd.emergency_discharge_summaries) ? dd.emergency_discharge_summaries : [dd.emergency_discharge_summaries]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Emergency Discharge Summaries</Text>
          <Text style={styles.noDataText}>No records available</Text>
        </Page>
      </Document>
    );
  }

  /* A field group = a wrap=false glue unit; the section title rides inside the FIRST visible field. */
  const renderField = (key, label, rows, showLabel, sectionTitle) => {
    const groupSize = rows.length + (showLabel ? 1 : 0) + (sectionTitle ? 1 : 0);
    return (
      <View key={key} style={styles.fieldGroup} wrap={groupSize > 8 ? true : false}>
        {sectionTitle ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null}
        {showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
        {rows.map((r, i) => (r.sub ? <Text key={i} style={styles.subLabel}>{r.text}</Text> : <Text key={i} style={styles.listItem}>{r.text}</Text>))}
      </View>
    );
  };

  const buildSections = (record) => {
    const sections = [];
    const scalar = (label, value) => ({ label, showLabel: true, rows: [{ text: `1. ${safeString(value)}` }] });
    const arrayField = (label, arr, showLabel = true) => {
      const rows = []; let an = 1;
      arr.forEach(it => {
        const p = parseLabel(String(it));                     // labeled item → sub-label + value row
        if (p.isLabeled) { rows.push({ sub: true, text: safeString(p.label) }); rows.push({ text: `1. ${safeString(p.value)}` }); }
        else rows.push({ text: `${an++}. ${safeString(it)}` });
      });
      return { label, showLabel, rows };
    };

    // 1. Arrival Information
    const arrival = [];
    if (hasVal(record.chiefComplaint)) arrival.push(scalar('Chief Complaint', record.chiefComplaint));
    if (hasVal(record.arrivalDateTime)) arrival.push({ label: 'Arrival Date/Time', showLabel: true, rows: [{ text: `1. ${formatDateTime(record.arrivalDateTime)}` }] });
    if (hasVal(record.dischargeDateTime)) arrival.push({ label: 'Discharge Date/Time', showLabel: true, rows: [{ text: `1. ${formatDateTime(record.dischargeDateTime)}` }] });
    if (hasVal(record.triageCategory)) arrival.push(scalar('Triage Category', record.triageCategory));
    if (hasVal(record.modeOfArrival)) arrival.push(scalar('Mode of Arrival', record.modeOfArrival));
    if (arrival.length) sections.push({ title: 'Arrival Information', fields: arrival });

    // 2. Vital Signs on Arrival (known subfields)
    const voa = record.vitalSignsOnArrival && typeof record.vitalSignsOnArrival === 'object' ? record.vitalSignsOnArrival : {};
    const voaFields = [];
    [['temperature', 'Temperature'], ['bloodPressure', 'Blood Pressure'], ['heartRate', 'Heart Rate'], ['respiratoryRate', 'Respiratory Rate'], ['oxygenSaturation', 'Oxygen Saturation'], ['painScore', 'Pain Score']].forEach(([k, lbl]) => {
      if (hasVal(voa[k])) voaFields.push(scalar(lbl, voa[k]));
    });
    if (voaFields.length) sections.push({ title: 'Vital Signs on Arrival', fields: voaFields });

    // 3. Vital Signs at Discharge (dynamic object)
    const vad = record.vitalSignsAtDischarge && typeof record.vitalSignsAtDischarge === 'object' ? record.vitalSignsAtDischarge : {};
    const vadFields = [];
    Object.entries(vad).forEach(([k, v]) => { if (hasVal(v)) vadFields.push(scalar(keyToLabel(k), v)); });
    if (vadFields.length) sections.push({ title: 'Vital Signs at Discharge', fields: vadFields });

    // 4. Emergency Diagnoses (single-name → no field label)
    const diag = Array.isArray(record.emergencyDiagnoses) ? record.emergencyDiagnoses.filter(Boolean) : [];
    if (diag.length) sections.push({ title: 'Emergency Diagnoses', fields: [arrayField('Emergency Diagnoses', diag, false)] });

    // 5. Procedures & Imaging
    const pi = [];
    const proc = Array.isArray(record.proceduresPerformed) ? record.proceduresPerformed.filter(Boolean) : [];
    const img = Array.isArray(record.imagingStudies) ? record.imagingStudies.filter(Boolean) : [];
    if (proc.length) pi.push(arrayField('Procedures Performed', proc));
    if (img.length) pi.push(arrayField('Imaging Studies', img));
    if (pi.length) sections.push({ title: 'Procedures & Imaging', fields: pi });

    // 6. Laboratory Tests (single-name)
    const labs = Array.isArray(record.laboratoryTests) ? record.laboratoryTests.filter(Boolean) : [];
    if (labs.length) sections.push({ title: 'Laboratory Tests', fields: [arrayField('Laboratory Tests', labs, false)] });

    // 7. Medications
    const meds = [];
    const medAdmin = Array.isArray(record.medicationsAdministered) ? record.medicationsAdministered.filter(Boolean) : [];
    const medDisch = Array.isArray(record.dischargeMedications) ? record.dischargeMedications.filter(Boolean) : [];
    if (medAdmin.length) meds.push(arrayField('Medications Administered', medAdmin));
    if (medDisch.length) meds.push(arrayField('Discharge Medications', medDisch));
    if (meds.length) sections.push({ title: 'Medications', fields: meds });

    // 8. Discharge Details
    const dd = [];
    if (hasVal(record.dischargeDisposition)) dd.push(scalar('Discharge Disposition', record.dischargeDisposition));
    if (hasVal(record.dischargeCondition)) dd.push(scalar('Discharge Condition', record.dischargeCondition));
    if (hasVal(record.ivAccessRemoved)) dd.push(scalar('IV Access Removed', record.ivAccessRemoved));
    if (hasVal(record.workRestrictions)) dd.push(scalar('Work Restrictions', record.workRestrictions));
    if (dd.length) sections.push({ title: 'Discharge Details', fields: dd });

    // 9. Follow-Up & Precautions (sentence)
    const fp = [];
    [['followUpInstructions', 'Follow-Up Instructions'], ['returnPrecautions', 'Return Precautions'], ['patientEducationProvided', 'Patient Education Provided']].forEach(([k, lbl]) => {
      if (hasVal(record[k])) { const rows = sentenceRows(record[k]); if (rows.length) fp.push({ label: lbl, showLabel: true, rows }); }
    });
    if (fp.length) sections.push({ title: 'Follow-Up & Precautions', fields: fp });

    // 10. Care Team & Allergies
    const ct = [];
    if (hasVal(record.attendingPhysician)) ct.push(scalar('Attending Physician', record.attendingPhysician));
    const consult = Array.isArray(record.consultingServices) ? record.consultingServices.filter(Boolean) : [];
    const allerg = Array.isArray(record.allergiesDocumented) ? record.allergiesDocumented.filter(Boolean) : [];
    if (consult.length) ct.push(arrayField('Consulting Services', consult));
    if (allerg.length) ct.push(arrayField('Allergies Documented', allerg));
    if (ct.length) sections.push({ title: 'Care Team & Allergies', fields: ct });

    return sections;
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Emergency Discharge Summaries</Text>
        {records.map((record, index) => {
          const sections = buildSections(record);
          return (
            <View key={index} style={styles.recordContainer} break={index > 0}>
              <View style={styles.recordHeadWrap} wrap={false}>
                <Text style={styles.recordTitle}>Emergency Discharge Summary {index + 1}</Text>
              </View>
              {sections.map((sec, si) => (
                <View key={si} style={styles.section}>
                  {sec.fields.map((fld, fi) => renderField(`${si}-${fi}`, fld.label, fld.rows, fld.showLabel, fi === 0 ? sec.title : null))}
                </View>
              ))}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default EmergencyDischargeSummariesDocumentPDFTemplate;
