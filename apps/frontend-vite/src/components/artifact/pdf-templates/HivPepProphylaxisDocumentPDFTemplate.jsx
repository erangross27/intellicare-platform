import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * HivPepProphylaxisDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (numbers incl. 0, booleans as Yes/No, dates) for JSX/PDF parity.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 */

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000', lineHeight: 1.4 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 10, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000000' },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldWrap: { marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 6, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 2 },
  value: { fontSize: 14, paddingLeft: 8, marginBottom: 3, lineHeight: 1.4 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#666666', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#cccccc', paddingTop: 6 },
  noData: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#666666' },
});

/* CONFIG (mirrors the JSX) */
const SECTION_ORDER = ['exposure-info', 'risk-assessment', 'pep-regimen', 'baseline-labs', 'pep-adherence', 'follow-up'];

const SECTION_TITLES = {
  'exposure-info':   'Exposure Information',
  'risk-assessment': 'Risk Assessment',
  'pep-regimen':     'PEP Regimen',
  'baseline-labs':   'Baseline Labs',
  'pep-adherence':   'PEP Adherence',
  'follow-up':       'Follow-Up',
};

const FIELD_LABELS = {
  exposureDateTime:                  'Exposure Date/Time',
  exposureType:                      'Exposure Type',
  exposureSourceHivStatus:           'Source HIV Status',
  sourceViralLoadCopiesPerMl:        'Source Viral Load (copies/mL)',
  hoursFromExposureToPepInitiation:  'Hours from Exposure to PEP Initiation',
  denverHivRiskScore:                'Denver HIV Risk Score',
  pepIndicationRiskCategory:         'PEP Indication Risk Category',
  bodyFluidInvolved:                 'Body Fluid Involved',
  exposureSiteAnatomical:            'Anatomical Exposure Site',
  needlestickDepthAndGauge:          'Needlestick Depth & Gauge',
  visibleBloodOnDevice:              'Visible Blood on Device',
  hollowBoreNeedleExposure:          'Hollow-Bore Needle Exposure',
  pepRegimen:                        'PEP Regimen',
  tenofovirFormulation:              'Tenofovir Formulation',
  integraseInhibitorSelected:        'Integrase Inhibitor Selected',
  baselineHivAgAbComboTest:          'Baseline HIV Ag/Ab Combo Test',
  baselineHivRnaQualitative:         'Baseline HIV RNA (Qualitative)',
  baselineCreatinineMgDl:            'Baseline Creatinine (mg/dL)',
  baselineEstimatedGfrMlMin:         'Baseline eGFR (mL/min)',
  baselineHbsAgStatus:               'Baseline HBsAg Status',
  baselineHcvAntibodyStatus:         'Baseline HCV Antibody Status',
  stiScreeningPerformed:             'STI Screening Performed',
  pepAdherencePercentage:            'PEP Adherence (%)',
  pepCompletedFullCourse:            'PEP Completed Full Course',
  pepDiscontinuationReason:          'PEP Discontinuation Reason',
  followUpHivTestWeek4To6:           'Follow-Up HIV Test (Week 4-6)',
  followUpHivTestMonth3:             'Follow-Up HIV Test (Month 3)',
  prepCandidateAssessed:             'PrEP Candidate Assessed',
  prepTransitionInitiated:           'PrEP Transition Initiated',
};

const SECTION_FIELDS = {
  'exposure-info':   ['exposureDateTime', 'exposureType', 'exposureSourceHivStatus', 'sourceViralLoadCopiesPerMl', 'hoursFromExposureToPepInitiation'],
  'risk-assessment': ['denverHivRiskScore', 'pepIndicationRiskCategory', 'bodyFluidInvolved', 'exposureSiteAnatomical', 'needlestickDepthAndGauge', 'visibleBloodOnDevice', 'hollowBoreNeedleExposure'],
  'pep-regimen':     ['pepRegimen', 'tenofovirFormulation', 'integraseInhibitorSelected'],
  'baseline-labs':   ['baselineHivAgAbComboTest', 'baselineHivRnaQualitative', 'baselineCreatinineMgDl', 'baselineEstimatedGfrMlMin', 'baselineHbsAgStatus', 'baselineHcvAntibodyStatus', 'stiScreeningPerformed'],
  'pep-adherence':   ['pepAdherencePercentage', 'pepCompletedFullCourse', 'pepDiscontinuationReason'],
  'follow-up':       ['followUpHivTestWeek4To6', 'followUpHivTestMonth3', 'prepCandidateAssessed', 'prepTransitionInitiated'],
};

const DATE_FIELDS    = ['exposureDateTime', 'prepCandidateAssessed'];
const BOOLEAN_FIELDS = ['visibleBloodOnDevice', 'hollowBoreNeedleExposure', 'pepCompletedFullCourse', 'prepTransitionInitiated'];
const NUMBER_FIELDS  = ['sourceViralLoadCopiesPerMl', 'hoursFromExposureToPepInitiation', 'denverHivRiskScore', 'baselineCreatinineMgDl', 'baselineEstimatedGfrMlMin', 'pepAdherencePercentage'];
const ARRAY_FIELDS   = ['stiScreeningPerformed'];

/* HELPERS (mirror the JSX) — safeString uses ONLY \uXXXX escapes (no literal smart quotes / invisible chars) */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u2028\u2029\uFEFF]/g, '');
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
  return { isLabeled: false, label: '', value: text };
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '')) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const strip = (s) => safeString(s).replace(/^\s*\d+\.\s+/, '').replace(/[;.]+$/, '').trim();

/* sentenceRows: splitBySentence -> parseLabel -> splitByComma, decomposing nested "Label: value"
   comma items into their own sub-label (mirrors the JSX decomposition; never side-by-side). */
const sentenceRows = (text) => {
  const rows = [];
  splitBySentence(text).forEach(sentence => {
    const p = parseLabel(sentence);
    if (p.isLabeled) {
      const items = splitByComma(p.value);
      if (items.length >= 2) {
        rows.push({ type: 'sub', text: p.label });
        items.forEach(it => {
          const ip = parseLabel(it);
          if (ip.isLabeled) { rows.push({ type: 'sub', text: ip.label }); rows.push({ type: 'item', text: ip.value }); }
          else rows.push({ type: 'item', text: it });
        });
      } else {
        rows.push({ type: 'sub', text: p.label });
        rows.push({ type: 'item', text: p.value });
      }
    } else {
      rows.push({ type: 'item', text: sentence });
    }
  });
  return rows;
};

const fieldBody = (record, f) => {
  const v = record[f];
  if (DATE_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(formatDate(v))}</Text>];
  if (BOOLEAN_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{v === true || v === 'Yes' || v === 'true' ? 'Yes' : 'No'}</Text>];
  if (NUMBER_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  if (ARRAY_FIELDS.includes(f)) {
    const items = Array.isArray(v) ? v.filter(it => it !== null && it !== undefined && String(it).trim() !== '') : [];
    return items.map((it, i) => <Text key={i} style={styles.value}>{`${i + 1}. ${strip(it)}`}</Text>);
  }
  const rows = sentenceRows(String(v));
  if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => hasVal(record[f]));
  if (present.length === 0) return null;
  const sectionTitle = SECTION_TITLES[sid];
  return present.map((f, i) => {
    const label = FIELD_LABELS[f] || f;
    const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
    return (
      <View key={f} style={styles.fieldWrap} wrap={false}>
        {i === 0 && <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>}
        {showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
        {fieldBody(record, f)}
      </View>
    );
  });
};

const HivPepProphylaxisDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) records = data;
  else if (data && typeof data === 'object') records = data.hiv_pep_prophylaxis ? (Array.isArray(data.hiv_pep_prophylaxis) ? data.hiv_pep_prophylaxis : [data.hiv_pep_prophylaxis]) : [data];
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>HIV PEP Prophylaxis</Text>
          <Text style={styles.noData}>No HIV PEP prophylaxis records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>HIV PEP Prophylaxis</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`HIV PEP Prophylaxis ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default HivPepProphylaxisDocumentPDFTemplate;
