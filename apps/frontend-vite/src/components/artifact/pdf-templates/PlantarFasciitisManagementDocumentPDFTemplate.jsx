/**
 * PlantarFasciitisManagementDocumentPDFTemplate.jsx
 * Box-free black & white -- Helvetica -- LETTER size -- plantar fasciitis management
 * Collection: plantar_fasciitis_management
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid', marginBottom: 3 },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

/* ======= UTILS ======= */
const formatDate = (d) => {
  if (!d) return '';
  try {
    const date = new Date(d.$date || d);
    if (isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(d); }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object' && val.$date) return formatDate(val.$date);
  return String(val);
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

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

/* A stored numeric 0 is hidden as an extractor "not recorded" sentinel unless the field is in MEANINGFUL_ZERO_FIELDS. */
const MEANINGFUL_ZERO_FIELDS = ['corticosteroidInjectionsCount', 'extracorporealShockwaveTherapySessions', 'occupationalStandingHours', 'painVasScore', 'symptomDurationWeeks', 'morningStiffnessDuration', 'dorsalAnkleDorsiflexion'];
const showNum = (fn, v) => hasVal(v) && !(typeof v === 'number' && v === 0 && !MEANINGFUL_ZERO_FIELDS.includes(fn));

const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
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

/* renderFieldRow: label above value inside fieldBox (box-free underline label) */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceField: parseLabel + comma-split with sequential counter, numbered rows */
const renderSentenceField = (label, text, counterRef) => {
  if (!hasVal(text)) return null;
  if (typeof text !== 'string') {
    return renderFieldRow(label, text);
  }
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  const rows = [];
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(parsed.value);
      if (commaItems.length >= 2) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: counterRef.n++ }); });
      } else {
        rows.push({ type: 'item', text: safeString(s), num: counterRef.n++ });
      }
    } else {
      rows.push({ type: 'item', text: safeString(s), num: counterRef.n++ });
    }
  });

  return (
    <View style={styles.fieldBox} wrap={rows.length > 8}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {rows.map((row, i) => {
        if (row.type === 'subtitle') {
          return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
        }
        return <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>;
      })}
    </View>
  );
};

const PlantarFasciitisManagementDocumentPDFTemplate = ({ document: data }) => {
  /* Handle data unwrapping */
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.plantar_fasciitis_management && Array.isArray(data.plantar_fasciitis_management)) {
    records = data.plantar_fasciitis_management;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) {
      records = docData;
    } else if (docData?.plantar_fasciitis_management) {
      records = docData.plantar_fasciitis_management;
    } else if (docData && typeof docData === 'object') {
      records = [docData];
    }
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.documentTitle}>Plantar Fasciitis Management</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Plantar Fasciitis Management</Text></View>
        {records.map((record, idx) => {
          const ctr = { n: 1 };
          return (
          <View key={idx} style={styles.recordContainer}>
            {idx > 0 && <View style={styles.separator} />}

            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Plantar Fasciitis Management ${idx + 1}`}</Text>
            </View>

            {/* 1. Pain Assessment */}
            {(showNum('painVasScore', record.painVasScore) || showNum('symptomDurationWeeks', record.symptomDurationWeeks) || showNum('morningStiffnessDuration', record.morningStiffnessDuration)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Pain Assessment</Text>
                {showNum('painVasScore', record.painVasScore) && renderFieldRow('Pain VAS Score', record.painVasScore)}
                {showNum('symptomDurationWeeks', record.symptomDurationWeeks) && renderFieldRow('Symptom Duration (Weeks)', record.symptomDurationWeeks)}
                {showNum('morningStiffnessDuration', record.morningStiffnessDuration) && renderFieldRow('Morning Stiffness Duration (min)', record.morningStiffnessDuration)}
              </View>
            )}

            {/* 2. Clinical Tests */}
            {(hasVal(record.windlassTestResult) || hasVal(record.gastrocnemiusSilvermannTest) || showNum('dorsalAnkleDorsiflexion', record.dorsalAnkleDorsiflexion)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Clinical Tests</Text>
                {renderSentenceField('Windlass Test Result', record.windlassTestResult, ctr)}
                {renderSentenceField('Gastrocnemius Silvermann Test', record.gastrocnemiusSilvermannTest, ctr)}
                {showNum('dorsalAnkleDorsiflexion', record.dorsalAnkleDorsiflexion) && renderFieldRow('Dorsal Ankle Dorsiflexion (degrees)', record.dorsalAnkleDorsiflexion)}
              </View>
            )}

            {/* 3. Imaging Findings */}
            {(showNum('plantarFasciaThickness', record.plantarFasciaThickness) || showNum('heelFatPadThickness', record.heelFatPadThickness) || showNum('archHeightIndex', record.archHeightIndex) || hasVal(record.calcanealSpurPresent) || hasVal(record.fascialHyperechogenicity)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Imaging Findings</Text>
                {showNum('plantarFasciaThickness', record.plantarFasciaThickness) && renderFieldRow('Plantar Fascia Thickness (mm)', record.plantarFasciaThickness)}
                {showNum('heelFatPadThickness', record.heelFatPadThickness) && renderFieldRow('Heel Fat Pad Thickness (mm)', record.heelFatPadThickness)}
                {showNum('archHeightIndex', record.archHeightIndex) && renderFieldRow('Arch Height Index', record.archHeightIndex)}
                {hasVal(record.calcanealSpurPresent) && renderFieldRow('Calcaneal Spur Present', record.calcanealSpurPresent)}
                {hasVal(record.fascialHyperechogenicity) && renderFieldRow('Fascial Hyperechogenicity', record.fascialHyperechogenicity)}
              </View>
            )}

            {/* 4. Treatment Interventions */}
            {(showNum('corticosteroidInjectionsCount', record.corticosteroidInjectionsCount) || showNum('extracorporealShockwaveTherapySessions', record.extracorporealShockwaveTherapySessions) || hasVal(record.prpInjectionAdministered) || hasVal(record.customOrthoticType) || hasVal(record.nightSplintCompliance) || hasVal(record.stretchingProtocolAdherence) || hasVal(record.fasciotomyIndicated)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Treatment Interventions</Text>
                {showNum('corticosteroidInjectionsCount', record.corticosteroidInjectionsCount) && renderFieldRow('Corticosteroid Injections Count', record.corticosteroidInjectionsCount)}
                {showNum('extracorporealShockwaveTherapySessions', record.extracorporealShockwaveTherapySessions) && renderFieldRow('ESWT Sessions', record.extracorporealShockwaveTherapySessions)}
                {hasVal(record.prpInjectionAdministered) && renderFieldRow('PRP Injection Administered', record.prpInjectionAdministered)}
                {hasVal(record.fasciotomyIndicated) && renderFieldRow('Fasciotomy Indicated', record.fasciotomyIndicated)}
                {renderSentenceField('Custom Orthotic Type', record.customOrthoticType, ctr)}
                {renderSentenceField('Night Splint Compliance', record.nightSplintCompliance, ctr)}
                {renderSentenceField('Stretching Protocol Adherence', record.stretchingProtocolAdherence, ctr)}
              </View>
            )}

            {/* 5. Functional Scores */}
            {(showNum('footFunctionIndex', record.footFunctionIndex) || showNum('aofasAnkleHindfootScore', record.aofasAnkleHindfootScore) || hasVal(record.rolesMaudsleyScore)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Functional Scores</Text>
                {showNum('footFunctionIndex', record.footFunctionIndex) && renderFieldRow('Foot Function Index', record.footFunctionIndex)}
                {showNum('aofasAnkleHindfootScore', record.aofasAnkleHindfootScore) && renderFieldRow('AOFAS Ankle-Hindfoot Score', record.aofasAnkleHindfootScore)}
                {renderSentenceField('Roles-Maudsley Score', record.rolesMaudsleyScore, ctr)}
              </View>
            )}

            {/* 6. Risk Factors */}
            {(showNum('bodyMassIndex', record.bodyMassIndex) || showNum('occupationalStandingHours', record.occupationalStandingHours) || hasVal(record.bilateralInvolvement)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Risk Factors</Text>
                {showNum('bodyMassIndex', record.bodyMassIndex) && renderFieldRow('Body Mass Index', record.bodyMassIndex)}
                {showNum('occupationalStandingHours', record.occupationalStandingHours) && renderFieldRow('Occupational Standing Hours', record.occupationalStandingHours)}
                {hasVal(record.bilateralInvolvement) && renderFieldRow('Bilateral Involvement', record.bilateralInvolvement)}
              </View>
            )}
          </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default PlantarFasciitisManagementDocumentPDFTemplate;
