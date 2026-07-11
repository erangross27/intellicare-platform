/**
 * FertilityMedicationManagementDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER size — BLACK & WHITE ONLY (#000000, no color/no boxes)
 * Data collection: fertility_medication_management
 *
 * Box-free — underlines only (documentTitle 2pt, sectionTitle 1pt black, fieldLabel 0.5pt #999).
 * Rule #74 — sections are wrap={false} atomic blocks; sectionTitle rides INSIDE the section View
 * as its first child. splitBySentence splits on [.;]. ZERO_SENTINEL_FIELDS (the ovarian-stimulation /
 * trigger / hormone-level / oral-medication metrics — N/A for a medicated FET recipient prep) are hidden,
 * mirroring JSX + Copy. createdAt/updatedAt (ingestion) are never rendered. PHI footer is STATIC only.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 10 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 4 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  noDataText: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8 },
  footerText: { fontSize: 10, color: '#666666' },
});

const ZERO_SENTINEL_FIELDS = ['gonadotropinDoseIU', 'triggerDoseIU', 'estradiolLevelPgMl', 'serumLhLevelMiuMl', 'serumProgesteroneLevelNgMl', 'stimulationDayNumber', 'totalStimulationDays', 'folliclesGreaterThan14mm', 'leadFollicleSizeMm', 'letrozoleDoseMg', 'clomipheneCitrateDoseMg'];
const NUMBER_FIELDS = ['gonadotropinDoseIU', 'triggerDoseIU', 'progesteroneDoseMg', 'estradiolLevelPgMl', 'serumLhLevelMiuMl', 'serumProgesteroneLevelNgMl', 'antiMullerianHormoneNgMl', 'antralFollicleCount', 'stimulationDayNumber', 'totalStimulationDays', 'folliclesGreaterThan14mm', 'leadFollicleSizeMm', 'endometrialThicknessMm', 'letrozoleDoseMg', 'clomipheneCitrateDoseMg'];
const BOOLEAN_FIELDS = ['cabergolineOhssProphylaxis'];
const ARRAY_FIELDS = ['adjunctMedications', 'medicationAdverseEvents'];
const ENUM_OPTIONS = { ohssRiskCategory: ['Low', 'Moderate', 'High', 'Very High'] };
const enumCanonical = (options, val) => { const s = String(val ?? '').trim(); const m = options.find(o => o.toLowerCase() === s.toLowerCase()); return m || s; };

const SECTIONS = [
  { title: 'Protocol Information', fields: [['medicationProtocolType', 'Medication Protocol Type'], ['gonadotropinType', 'Gonadotropin Type'], ['gonadotropinDoseIU', 'Gonadotropin Dose (IU)'], ['gnrhAgonistAgent', 'GnRH Agonist Agent'], ['gnrhAntagonistAgent', 'GnRH Antagonist Agent']] },
  { title: 'Trigger & Luteal Phase Support', fields: [['triggerMedicationType', 'Trigger Medication Type'], ['triggerDoseIU', 'Trigger Dose (IU)'], ['lutealPhaseSupportRegimen', 'Luteal Phase Support Regimen'], ['progesteroneDoseMg', 'Progesterone Dose (mg)']] },
  { title: 'Hormone Levels', fields: [['estradiolLevelPgMl', 'Estradiol Level (pg/mL)'], ['serumLhLevelMiuMl', 'Serum LH Level (mIU/mL)'], ['serumProgesteroneLevelNgMl', 'Serum Progesterone Level (ng/mL)'], ['antiMullerianHormoneNgMl', 'Anti-Mullerian Hormone (ng/mL)']] },
  { title: 'Follicle Monitoring', fields: [['antralFollicleCount', 'Antral Follicle Count'], ['stimulationDayNumber', 'Stimulation Day Number'], ['totalStimulationDays', 'Total Stimulation Days'], ['folliclesGreaterThan14mm', 'Follicles > 14mm'], ['leadFollicleSizeMm', 'Lead Follicle Size (mm)'], ['endometrialThicknessMm', 'Endometrial Thickness (mm)']] },
  { title: 'Risk Assessment', fields: [['ohssRiskCategory', 'OHSS Risk Category'], ['cabergolineOhssProphylaxis', 'Cabergoline OHSS Prophylaxis']] },
  { title: 'Oral Medications', fields: [['letrozoleDoseMg', 'Letrozole Dose (mg)'], ['clomipheneCitrateDoseMg', 'Clomiphene Citrate Dose (mg)']] },
  { title: 'Additional Medications & Adverse Events', fields: [['adjunctMedications', 'Adjunct Medications'], ['medicationAdverseEvents', 'Medication Adverse Events']] },
];

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : (typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val));
  return str.replace(/[µμ]m/g, 'um').replace(/[µμ]g/g, 'mcg').replace(/[µμ]/g, 'u').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->')
    .replace(/“/g, '"').replace(/”/g, '"').replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
};
const hasStr = (v) => { if (v === null || v === undefined) return false; if (typeof v === 'string') return v.trim() !== ''; if (typeof v === 'number') return true; if (typeof v === 'boolean') return true; if (Array.isArray(v)) return v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0; return String(v).trim() !== ''; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};
const splitByComma = (text) => {
  if (!text) return [];
  const s = String(text); const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') { depth++; cur += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; }
    else if (ch === ',' && depth === 0) {
      const nx = s[i + 1] || ''; const nextWord = s.slice(i + 1).trim().split(/\s+/)[0] || '';
      if (/\d/.test(nx.trim()) || /^(and|or)\b/i.test(nextWord)) { cur += ch; }
      else { const t = cur.trim(); if (t) out.push(t); cur = ''; }
    } else cur += ch;
  }
  const t = cur.trim(); if (t) out.push(t);
  return out.length ? out : [String(text)];
};

const isVisible = (key, val) => {
  if (ARRAY_FIELDS.includes(key)) return Array.isArray(val) && val.filter(hasStr).length > 0;
  if (NUMBER_FIELDS.includes(key)) { if (val === null || val === undefined || val === '') return false; if (ZERO_SENTINEL_FIELDS.includes(key) && Number(val) === 0) return false; return true; }
  if (BOOLEAN_FIELDS.includes(key)) return val !== null && val !== undefined;
  return hasStr(val);
};

/* render one field (label above value; strings comma-split; arrays numbered) */
const renderField = (key, label, val) => {
  if (ARRAY_FIELDS.includes(key)) {
    const items = (Array.isArray(val) ? val : []).filter(hasStr);
    return (
      <View key={key}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {items.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(String(it))}</Text>)}
      </View>
    );
  }
  if (NUMBER_FIELDS.includes(key) || BOOLEAN_FIELDS.includes(key)) {
    return (
      <View key={key}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{safeString(fmtVal(val))}</Text>
      </View>
    );
  }
  if (ENUM_OPTIONS[key]) {
    return (
      <View key={key}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{safeString(enumCanonical(ENUM_OPTIONS[key], val))}</Text>
      </View>
    );
  }
  /* string → guarded comma-split (plain if single) */
  const items = [];
  splitBySentence(fmtVal(val)).forEach(s => { const p = parseLabel(s); (p.isLabeled ? splitByComma(p.value) : splitByComma(s)).forEach(x => items.push(x)); });
  const clean = items.map(x => safeString(String(x).replace(/[;.]+$/, '').trim())).filter(Boolean);
  return (
    <View key={key}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {clean.length <= 1
        ? <Text style={styles.fieldValue}>{clean[0] || safeString(fmtVal(val))}</Text>
        : clean.map((c, i) => <Text key={i} style={styles.listItem}>{i + 1}. {c}</Text>)}
    </View>
  );
};

const FertilityMedicationManagementDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.fertility_medication_management) return Array.isArray(r.fertility_medication_management) ? r.fertility_medication_management : [r.fertility_medication_management];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.fertility_medication_management) return Array.isArray(dd.fertility_medication_management) ? dd.fertility_medication_management : [dd.fertility_medication_management]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Fertility Medication Management</Text>
          <Text style={styles.noDataText}>No fertility medication management records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Fertility Medication Management</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>Fertility Medication Management {idx + 1}</Text>
            {SECTIONS.map(sec => {
              const present = sec.fields.filter(([key]) => isVisible(key, record[key]));
              if (present.length === 0) return null;
              return (
                <View key={sec.title} style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>{sec.title}</Text>
                  {present.map(([key, label]) => renderField(key, label, record[key]))}
                </View>
              );
            })}
          </View>
        ))}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
        </View>
      </Page>
    </Document>
  );
};

export default FertilityMedicationManagementDocumentPDFTemplate;
