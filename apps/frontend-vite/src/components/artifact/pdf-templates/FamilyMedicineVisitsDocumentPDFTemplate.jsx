/**
 * FamilyMedicineVisitsDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER size — BLACK & WHITE ONLY (#000000, no color/no boxes)
 * Data collection: family_medicine_visits
 *
 * Box-free — underlines only (documentTitle 2pt, sectionTitle 1pt black, fieldLabel 0.5pt #999).
 * Rule #74 — small sections are wrap={false} atomic blocks; large sections (ROS / Physical Exam /
 * Medications) are breakable, with each item in its own wrap={false} View and the sectionTitle glued
 * inside the first item (never an orphaned sibling, never the unbreakable ternary wrap idiom).
 * Every flat scalar field renders a standalone label (JSX/PDF parity). visitDate is the clinical
 * visit date the JSX edits; createdAt/updatedAt (ingestion) are never rendered.
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
  groupLabel: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 4 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 4 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  noDataText: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 10, color: '#666666' },
});

const ROS_LABELS = { constitutional: 'Constitutional', heent: 'HEENT', cardiovascular: 'Cardiovascular', respiratory: 'Respiratory', gi: 'Gastrointestinal', gu: 'Genitourinary', musculoskeletal: 'Musculoskeletal', neurological: 'Neurological', skin: 'Skin', psychiatric: 'Psychiatric', endocrine: 'Endocrine' };
const PE_LABELS = { general: 'General', heent: 'HEENT', neck: 'Neck', cardiovascular: 'Cardiovascular', pulmonary: 'Pulmonary', abdomen: 'Abdomen', extremities: 'Extremities', neurological: 'Neurological', skin: 'Skin', musculoskeletal: 'Musculoskeletal' };
const MED_FIELDS = [['dosage', 'Dosage'], ['frequency', 'Frequency'], ['route', 'Route'], ['indication', 'Indication'], ['status', 'Status'], ['active', 'Active'], ['prn', 'PRN']];

const hasStr = (v) => v !== null && v !== undefined && String(v).trim() !== '';
const camelToTitle = (str) => (!str ? '' : String(str).replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim());
const safeString = (val) => { if (val === null || val === undefined) return ''; if (typeof val === 'boolean') return val ? 'Yes' : 'No'; if (typeof val === 'object') return ''; return String(val); };

const formatDate = (dateString) => {
  if (!dateString) return '';
  try { return new Date(dateString.$date || dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch { return String(dateString); }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

/* one labeled scalar field: standalone label + value below */
const Field = ({ label, value }) => (hasStr(value) ? (
  <View>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Text style={styles.fieldValue}>{safeString(value)}</Text>
  </View>
) : null);

/* single-name sentence field (chief complaint / HPI / plan): title only + numbered rows */
const sentenceRows = (text) => {
  const sentences = splitBySentence(String(text || ''));
  if (sentences.length <= 1) return [<Text key="0" style={styles.listItem}>1. {String(text || '').replace(/[;.]+$/, '').trim()}</Text>];
  return sentences.map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s.replace(/[;.]+$/, '').trim()}</Text>);
};

const FamilyMedicineVisitsDocumentPDFTemplate = ({ document: records }) => {
  if (!records || !Array.isArray(records) || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Family Medicine Visits</Text>
          <Text style={styles.noDataText}>No family medicine visits records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Family Medicine Visits</Text>
        {records.map((record, idx) => {
          const ros = record.reviewOfSystems || {};
          const pe = record.physicalExam || {};
          const rosEntries = Object.entries(ros).filter(([, v]) => hasStr(v));
          const peEntries = Object.entries(pe).filter(([, v]) => hasStr(v));
          const assessment = Array.isArray(record.assessment) ? record.assessment.filter(hasStr) : [];
          const orders = Array.isArray(record.orders) ? record.orders.filter(hasStr) : [];
          const meds = Array.isArray(record.medications) ? record.medications.filter(m => m && (hasStr(m.name) || MED_FIELDS.some(([k]) => hasStr(m[k])))) : [];

          return (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              <Text style={styles.recordTitle}>Family Medicine Visit {idx + 1}</Text>

              {/* Visit Information */}
              {(hasStr(record.visitDate) || hasStr(record.visitType) || hasStr(record.status)) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Visit Information</Text>
                  <Field label="Visit Date" value={record.visitDate ? formatDate(record.visitDate) : ''} />
                  <Field label="Visit Type" value={record.visitType} />
                  <Field label="Status" value={record.status} />
                </View>
              )}

              {/* Provider Details */}
              {(hasStr(record.providerName) || hasStr(record.providerSpecialty) || hasStr(record.facilityName)) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Provider Details</Text>
                  <Field label="Provider" value={record.providerName} />
                  <Field label="Specialty" value={record.providerSpecialty} />
                  <Field label="Facility" value={record.facilityName} />
                </View>
              )}

              {/* Chief Complaint (single-name) */}
              {hasStr(record.chiefComplaint) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Chief Complaint</Text>
                  {sentenceRows(record.chiefComplaint)}
                </View>
              )}

              {/* History of Present Illness (single-name) */}
              {hasStr(record.historyOfPresentIllness) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>History of Present Illness</Text>
                  {sentenceRows(record.historyOfPresentIllness)}
                </View>
              )}

              {/* Review of Systems — breakable; each sub-field atomic, title glued to first */}
              {rosEntries.length > 0 && (
                <View style={styles.section}>
                  {rosEntries.map(([k, v], i) => (
                    <View key={k} wrap={false}>
                      {i === 0 && <Text style={styles.sectionTitle}>Review of Systems</Text>}
                      <Field label={ROS_LABELS[k] || camelToTitle(k)} value={v} />
                    </View>
                  ))}
                </View>
              )}

              {/* Physical Exam — breakable; each sub-field atomic, title glued to first */}
              {peEntries.length > 0 && (
                <View style={styles.section}>
                  {peEntries.map(([k, v], i) => (
                    <View key={k} wrap={false}>
                      {i === 0 && <Text style={styles.sectionTitle}>Physical Exam</Text>}
                      <Field label={PE_LABELS[k] || camelToTitle(k)} value={v} />
                    </View>
                  ))}
                </View>
              )}

              {/* Assessment (single-name, numbered) */}
              {assessment.length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Assessment</Text>
                  {assessment.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>)}
                </View>
              )}

              {/* Plan (single-name, numbered) */}
              {hasStr(record.plan) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Plan</Text>
                  {sentenceRows(record.plan)}
                </View>
              )}

              {/* Medications — each med is a direct, atomic (wrap=false) child of the record container so
                  the page flow paginates them; NO intermediate breakable wrapper (react-pdf 4.5.1 throws an
                  "unsupported number" overflow when a nested breakable View's content exceeds a page). Title
                  is glued inside the first med. Sub-fields STACKED (label / value), never side-by-side. */}
              {meds.map((med, i) => (
                <View key={`med-${i}`} wrap={false} style={i === meds.length - 1 ? styles.section : { marginBottom: 8 }}>
                  {i === 0 ? <Text style={styles.sectionTitle}>Medications</Text> : null}
                  <Text style={styles.groupLabel}>{i + 1}. {safeString(med.name || 'Unknown')}</Text>
                  {MED_FIELDS.filter(([k]) => med[k] !== null && med[k] !== undefined && med[k] !== '').map(([k, lbl]) => (
                    <Field key={k} label={lbl} value={med[k]} />
                  ))}
                </View>
              ))}

              {/* Orders (single-name, numbered) */}
              {orders.length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Orders</Text>
                  {orders.map((o, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(o)}</Text>)}
                </View>
              )}

              {/* Follow-Up & Notes */}
              {(hasStr(record.followUp) || hasStr(record.notes)) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Follow-Up &amp; Notes</Text>
                  {hasStr(record.followUp) && (
                    <View>
                      <Text style={styles.fieldLabel}>Follow-Up</Text>
                      {sentenceRows(record.followUp)}
                    </View>
                  )}
                  {hasStr(record.notes) && (
                    <View>
                      <Text style={styles.fieldLabel}>Notes</Text>
                      {sentenceRows(record.notes)}
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
        </View>
      </Page>
    </Document>
  );
};

export default FamilyMedicineVisitsDocumentPDFTemplate;
