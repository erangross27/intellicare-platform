/**
 * DnrOrdersDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER — BLACK & WHITE only (#000000 titles/values, #999999 label rules).
 * Collection: dnr_orders.
 *
 * BOX-FREE canonical (one-pass items 9-11): page 14 / title 26 / recordTitle 19 / sectionTitle 16 +
 * 1pt black rule / fieldLabel 13 + 0.5pt #999 rule / values 14. Rule #74: wrap is BOOLEAN only; each
 * field is its own glue unit; the sectionTitle rides inside the first unit. Every value row numbered.
 * break={idx>0} → one record per page. Mirrors the JSX/copy — single-name sections hide the sub-label;
 * every narrative field splits by sentence → semicolon → guarded comma. Empty sections drop.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 18, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000' },
  recordContainer: { paddingBottom: 6 },
  recordHeader: { marginBottom: 4 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 2 },
  section: { marginBottom: 6 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 5, paddingBottom: 2, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldGroup: { marginBottom: 2 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2, paddingBottom: 1, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  value: { fontSize: 14, lineHeight: 1.35, color: '#000000', marginBottom: 1 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

/* ═══ CONSTANTS (mirror the JSX) ═══ */
const SECTION_TITLES = {
  'code-status': 'Code Status', 'resuscitation': 'Resuscitation Preferences', 'advance-directive': 'Advance Directive Status',
  'healthcare-proxy': 'Healthcare Proxy', 'functional-status': 'Functional Status Baseline', 'nutrition-hydration': 'Nutrition & Hydration',
  'emergency-contacts': 'Emergency Contacts', 'organ-donation': 'Organ Donation', 'palliative-prognosis': 'Palliative Care & Prognosis',
  'order-details': 'Order & Additional Details',
};
const SECTION_ORDER = ['code-status', 'resuscitation', 'advance-directive', 'healthcare-proxy', 'functional-status', 'nutrition-hydration', 'emergency-contacts', 'organ-donation', 'palliative-prognosis', 'order-details'];
const SECTION_FIELDS = {
  'code-status': ['codeStatusLevel'], 'resuscitation': ['resuscitationPreferences'], 'advance-directive': ['patientAdvanceDirectiveStatus'],
  'healthcare-proxy': ['healthcareProxyDesignated'], 'functional-status': ['functionalStatusBaseline'], 'nutrition-hydration': ['artificalNutritionHydration'],
  'emergency-contacts': ['emergencyContactInformation'], 'organ-donation': ['organDonationStatus'],
  'palliative-prognosis': ['palliativeCarePlanActive', 'prognosisDiscussion', 'decisionMakingCapacity'],
  'order-details': ['physianOrderDateTime', 'orderReviewSchedule', 'hospitalVsOutpatientScope', 'comfortMeasuresSpecified', 'witnessInformation', 'familyNotificationPreferences', 'religiousConsiderations', 'reversalConditions'],
};
const FIELD_LABELS = {
  codeStatusLevel: 'Code Status Level', resuscitationPreferences: 'Resuscitation Preferences', patientAdvanceDirectiveStatus: 'Advance Directive Status',
  healthcareProxyDesignated: 'Healthcare Proxy Designated', functionalStatusBaseline: 'Functional Status Baseline', artificalNutritionHydration: 'Artificial Nutrition & Hydration',
  emergencyContactInformation: 'Emergency Contact Information', organDonationStatus: 'Organ Donation Status', palliativeCarePlanActive: 'Palliative Care Plan Active',
  prognosisDiscussion: 'Prognosis Discussion', decisionMakingCapacity: 'Decision Making Capacity', physianOrderDateTime: 'Physician Order Date',
  orderReviewSchedule: 'Order Review Schedule', hospitalVsOutpatientScope: 'Hospital vs Outpatient Scope', comfortMeasuresSpecified: 'Comfort Measures Specified',
  witnessInformation: 'Witness Information', familyNotificationPreferences: 'Family Notification Preferences', religiousConsiderations: 'Religious Considerations',
  reversalConditions: 'Reversal Conditions',
};
const SENTENCE_FIELDS = new Set(['codeStatusLevel', 'resuscitationPreferences', 'patientAdvanceDirectiveStatus', 'healthcareProxyDesignated', 'functionalStatusBaseline', 'artificalNutritionHydration', 'emergencyContactInformation', 'organDonationStatus', 'prognosisDiscussion', 'decisionMakingCapacity', 'orderReviewSchedule', 'hospitalVsOutpatientScope', 'familyNotificationPreferences', 'religiousConsiderations', 'reversalConditions']);
const DATE_FIELDS = new Set(['physianOrderDateTime']);
const BOOLEAN_FIELDS = new Set(['palliativeCarePlanActive']);
const ARRAY_FIELDS = new Set(['comfortMeasuresSpecified', 'witnessInformation']);

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/×/g, 'x').replace(/²/g, '2')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean' || typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const formatDate = (dateValue) => { if (!dateValue) return ''; try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); } };

const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const splitBySemicolon = (text) => (!text || typeof text !== 'string') ? [] : text.split(/;\s*/).map(s => s.trim()).filter(Boolean);
const parseLabel = (text) => { if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' }; const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/); if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() }; return { isLabeled: false, label: '', value: text }; };
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) { const ch = text[i]; if (ch === '(') { depth++; current += ch; } else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; } else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; } else { current += ch; } }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};
const splitGuardedComma = (text) => {
  const s = String(text || ''); const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; continue; }
    if (ch === ',' && depth === 0) {
      const noSpace = s[i + 1] !== ' ';
      let j = i + 1; while (j < s.length && s[j] === ' ') j++;
      const rest = s.slice(j); const nextChar = s[j] || '';
      const andOrAfter = /^(and|or)\b/i.test(rest);
      const andOrBefore = /\b(and|or)\s*$/i.test(cur);
      const dateComma = /\d\s*$/.test(cur) && /^\d{4}\b/.test(rest);
      const nextOk = /[A-Za-z(>]/.test(nextChar);
      if (!noSpace && !andOrAfter && !andOrBefore && !dateComma && nextOk) { const p = cur.trim(); if (p) out.push(p); cur = ''; continue; }
    }
    cur += ch;
  }
  const p = cur.trim(); if (p) out.push(p);
  return out;
};

/* sentenceLines: numbered lines for a sentence field (mirror formatSentenceFieldLines). */
const sentenceLines = (text) => {
  const sentences = splitBySentence(fmtVal(text));
  const lines = []; let n = 1;
  sentences.forEach(s => {
    const p = parseLabel(s);
    if (p.isLabeled) {
      const parts = splitByComma(p.value);
      lines.push(safeString(p.label) + ':');
      if (parts.length >= 2) parts.forEach(it => lines.push(`  ${n++}. ${safeString(it)}`));
      else lines.push(`  ${n++}. ${safeString(p.value)}`);
      return;
    }
    splitBySemicolon(s).forEach(part => {
      const items = splitGuardedComma(part);
      if (items.length >= 3) items.forEach(it => lines.push(`${n++}. ${safeString(it)}`));
      else lines.push(`${n++}. ${safeString(part.replace(/[;.]+$/, '').trim())}`);
    });
  });
  return lines;
};

/* fieldUnit: build one { label, lines } unit for a field (single-name aware). */
const fieldUnit = (record, fn, sectionTitle) => {
  const val = record[fn];
  if (!hasVal(val)) return null;
  const label = FIELD_LABELS[fn] || fn;
  const lbl = label.toLowerCase() === sectionTitle.toLowerCase() ? null : label;
  if (DATE_FIELDS.has(fn)) return { label: lbl, lines: [`1. ${formatDate(val)}`] };
  if (BOOLEAN_FIELDS.has(fn)) return { label: lbl, lines: [`1. ${val ? 'Yes' : 'No'}`] };
  if (ARRAY_FIELDS.has(fn)) return { label: lbl, lines: (Array.isArray(val) ? val : []).filter(hasVal).map((it, i) => `${i + 1}. ${safeString(it)}`) };
  if (SENTENCE_FIELDS.has(fn)) return { label: lbl, lines: sentenceLines(val) };
  return { label: lbl, lines: [`1. ${safeString(fmtVal(val))}`] };
};

const DnrOrdersDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.dnr_orders) return Array.isArray(r.dnr_orders) ? r.dnr_orders : [r.dnr_orders];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.dnr_orders) return Array.isArray(dd.dnr_orders) ? dd.dnr_orders : [dd.dnr_orders]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document title="DNR Orders">
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>DNR Orders</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  const renderUnits = (title, units, keyPrefix) => units.length === 0 ? null : (
    <View style={styles.section}>
      {units.map((u, i) => (
        <View key={`${keyPrefix}-${i}`} style={styles.fieldGroup} wrap={u.lines.length > 8}>
          {i === 0 ? <Text style={styles.sectionTitle}>{title}</Text> : null}
          {u.label ? <Text style={styles.fieldLabel}>{safeString(u.label)}</Text> : null}
          {u.lines.map((ln, li) => <Text key={li} style={styles.value}>{safeString(ln)}</Text>)}
        </View>
      ))}
    </View>
  );

  const renderRecord = (record, idx) => (
    <View key={idx} style={styles.recordContainer} break={idx > 0}>
      <View style={styles.recordHeader} wrap={false}>
        <Text style={styles.recordTitle}>{`DNR Order ${idx + 1}`}</Text>
      </View>
      {SECTION_ORDER.map(sid => {
        const title = SECTION_TITLES[sid];
        const units = (SECTION_FIELDS[sid] || []).map(fn => fieldUnit(record, fn, title)).filter(u => u && u.lines.length > 0);
        return renderUnits(title, units, sid);
      })}
    </View>
  );

  return (
    <Document title="DNR Orders">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>DNR Orders</Text></View>
        {records.map((record, idx) => renderRecord(record, idx))}
      </Page>
    </Document>
  );
};

export default DnrOrdersDocumentPDFTemplate;
