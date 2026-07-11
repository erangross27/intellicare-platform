import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Burn Assessment Document PDF Template - February 2026
 * Helvetica font, professional layout, A4
 * wrap conditional pattern: items > 8 threshold
 */

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentHeader: {
    marginBottom: 20,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 12,
  },
  documentTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recordContainer: {
    marginBottom: 24,
    paddingBottom: 16,
  },
  recordHeader: {
    marginBottom: 12,
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderWidth: 1,
    borderColor: '#000000',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
  },
  recordMeta: {
    fontSize: 11,
    marginTop: 6,
    color: '#333333',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 4,
    marginBottom: 8,
  },
  // Label-above-value block (mirrors the on-screen JSX: nested-subtitle label, then content-value).
  fieldBlock: {
    marginBottom: 8,
    paddingLeft: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 12,
    color: '#000000',
    lineHeight: 1.4,
  },
  // Array items render as plain values in the JSX (no numbering).
  arrayItem: {
    fontSize: 12,
    color: '#000000',
    lineHeight: 1.4,
    marginBottom: 6,
    paddingLeft: 12,
  },
  noData: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginTop: 40,
  },
});

const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch { return String(dateString); }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return '';
  return String(val);
};

const safeArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(v => v !== null && v !== undefined && v !== '');
  return [];
};

const hasValue = (val) => {
  if (val === null || val === undefined || val === '') return false;
  if (typeof val === 'number') return true;
  if (typeof val === 'boolean') return true;
  if (typeof val === 'string') return val.trim() !== '';
  return true;
};

// Fields where a numeric 0 is a sentinel ("not calculated / not measured") and should be hidden.
const hasNumber = (val) => hasValue(val) && !(typeof val === 'number' && val === 0);

const BurnAssessmentDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (Array.isArray(templateData)) return templateData;
    if (templateData?.burn_assessment) return templateData.burn_assessment;
    if (templateData?.documentData) {
      const docData = templateData.documentData;
      if (Array.isArray(docData)) return docData;
      if (docData?.burn_assessment) return docData.burn_assessment;
      return [docData];
    }
    if (templateData && typeof templateData === 'object') return [templateData];
    return [];
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Burn Assessment</Text>
          </View>
          <Text style={styles.noData}>No burn assessment data available</Text>
        </Page>
      </Document>
    );
  }

  // Build a field node (label-above-value). Booleans -> Yes/No; empty values are dropped at render time.
  const field = (label, val) => ({
    kind: 'field',
    label,
    value: typeof val === 'boolean' ? (val ? 'Yes' : 'No') : (hasValue(val) ? safeString(val) : ''),
  });
  // Build plain value nodes for an array field (no numbering, mirroring the JSX).
  const items = (arr) => safeArray(arr).map((v) => ({ kind: 'item', value: safeString(v) }));

  // Render a section as the on-screen JSX does: a Title, then label-above-value blocks and/or plain
  // array values (NOT a two-column "label: value" row).
  const renderBlockSection = (title, nodes) => {
    const valid = nodes.filter((n) => hasValue(n.value));
    if (valid.length === 0) return null;
    return (
      <View style={styles.section} wrap={valid.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {valid.map((n, i) => n.kind === 'field' ? (
          <View key={i} style={styles.fieldBlock} wrap={false}>
            <Text style={styles.fieldLabel}>{n.label}</Text>
            <Text style={styles.fieldValue}>{n.value}</Text>
          </View>
        ) : (
          <Text key={i} style={styles.arrayItem}>{n.value}</Text>
        ))}
      </View>
    );
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Burn Assessment</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} minPresenceAhead={80}>
            {/* Record Header — date above the title, mirroring the JSX */}
            <View style={styles.recordHeader} wrap={false}>
              {(record.burnDate || record.date) && (
                <Text style={styles.recordMeta}>{formatDate(record.burnDate || record.date)}</Text>
              )}
              <Text style={styles.recordTitle}>Burn Assessment {idx + 1}</Text>
            </View>

            {/* Burn Information */}
            {renderBlockSection('Burn Information', [
              field('Burn Etiology', record.burnEtiology),
              field('Burn Depth', record.burnDepthClassification),
              field('TBSA %', record.tbsaPercentage),
            ])}

            {/* Anatomical Locations */}
            {renderBlockSection('Anatomical Locations', items(record.anatomicalLocationsBurned))}

            {/* Inhalation Injury */}
            {renderBlockSection('Inhalation Injury', [
              field('Inhalation Injury', record.inhalationInjuryPresent),
              field('Carboxyhemoglobin Level', record.carboxyhemoglobinLevel),
            ])}

            {/* Fluid Resuscitation */}
            {renderBlockSection('Fluid Resuscitation', [
              field('Parkland Formula (mL)', record.parklandFormulaCalculation),
              field('Fluid Rate (mL/hr)', hasNumber(record.fluidResuscitationRate) ? record.fluidResuscitationRate : null),
              field('Urine Output Target (mL/kg/hr)', record.urineOutputTarget),
            ])}

            {/* Escharotomy — field + sites combined, like the JSX */}
            {renderBlockSection('Escharotomy', [
              field('Escharotomy Required', record.escharotomyRequired),
              ...items(record.escharotomySites),
            ])}

            {/* Severity Scoring */}
            {renderBlockSection('Severity Scoring', [
              field('Baux Score', hasNumber(record.bauxScore) ? record.bauxScore : null),
              field('ABSI Score', hasNumber(record.absiScore) ? record.absiScore : null),
            ])}

            {/* Referral Criteria */}
            {renderBlockSection('Referral Criteria', items(record.burnCenterReferralCriteria))}

            {/* Wound Care — fields + culture results combined, like the JSX */}
            {renderBlockSection('Wound Care', [
              field('Wound Dressing', record.woundDressingType),
              field('Grafting Required', record.graftingRequired),
              field('Graft Donor Site', record.graftDonorSite),
              ...items(record.woundCultureResults),
            ])}

            {/* Clinical */}
            {renderBlockSection('Clinical', [
              field('Tetanus Prophylaxis', record.tetanusProphylaxisStatus),
              field('Caloric Requirement', hasNumber(record.caloricRequirementCalculation) ? record.caloricRequirementCalculation : null),
              field('Prealbumin Level', hasNumber(record.prealbuminLevel) ? record.prealbuminLevel : null),
            ])}

            {/* Contracture Risk */}
            {renderBlockSection('Contracture Risk', items(record.contractureRiskAreas))}

            {/* Etiology Details */}
            {renderBlockSection('Etiology Details', [
              field('Electrical Burn Voltage', record.electricalBurnVoltage),
              field('Chemical Agent', record.chemicalAgentInvolved),
            ])}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default BurnAssessmentDocumentPDFTemplate;
