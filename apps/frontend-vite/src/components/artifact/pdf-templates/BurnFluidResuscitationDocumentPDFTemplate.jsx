import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Burn Fluid Resuscitation Document PDF Template
 * Helvetica, A4, black/white only. Conditional wrap (items > 8 threshold),
 * section title INSIDE the section View (anti-orphan). Mirrors BurnWoundCare PDF.
 */

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 20, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 12 },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  recordContainer: { marginBottom: 24, paddingBottom: 16 },
  recordHeader: { marginBottom: 12, backgroundColor: '#f0f0f0', padding: 10, borderWidth: 1, borderColor: '#000000' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase' },
  recordMeta: { fontSize: 11, marginTop: 6, color: '#333333' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 4, marginBottom: 8 },
  nestedSubtitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', paddingLeft: 12, marginBottom: 2, marginTop: 6 },
  numberedItem: { flexDirection: 'row', marginBottom: 4, paddingLeft: 24 },
  itemNumber: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', width: 24 },
  itemContent: { fontSize: 12, color: '#000000', flex: 1, lineHeight: 1.4 },
  noData: { fontSize: 12, color: '#666666', textAlign: 'center', marginTop: 40 },
});

const formatDate = (dateString) => {
  if (!dateString) return '';
  try { return new Date(dateString.$date || dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch { return String(dateString); }
};

const hasValue = (val) => {
  if (val === null || val === undefined || val === '') return false;
  if (typeof val === 'number') return true;
  if (typeof val === 'boolean') return true;
  if (typeof val === 'string') return val.trim() !== '';
  return true;
};

const num = (v, unit) => hasValue(v) && v !== 0 ? `${v}${unit ? ' ' + unit : ''}` : null;
const yn = (v) => (v === true ? 'Yes' : v === false ? 'No' : null);

const BurnFluidResuscitationDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (Array.isArray(templateData)) return templateData;
    if (templateData?.burn_fluid_resuscitation) return templateData.burn_fluid_resuscitation;
    if (templateData?.documentData) {
      const docData = templateData.documentData;
      if (Array.isArray(docData)) return docData;
      if (docData?.burn_fluid_resuscitation) return docData.burn_fluid_resuscitation;
      return [docData];
    }
    if (templateData && typeof templateData === 'object') return [templateData];
    return [];
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.documentTitle}>Burn Fluid Resuscitation</Text></View>
          <Text style={styles.noData}>No burn fluid resuscitation data available</Text>
        </Page>
      </Document>
    );
  }

  // Section title INSIDE the View; conditional wrap (Rule #74). Each entry = [label, displayValue|null].
  const renderFieldSection = (title, entries) => {
    const valid = entries.filter(([, val]) => val !== null && val !== undefined && val !== '');
    if (valid.length === 0) return null;
    return (
      <View style={styles.section} wrap={valid.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {valid.map(([label, val], i) => (
          <View key={i}>
            <Text style={styles.nestedSubtitle}>{label}</Text>
            <View style={styles.numberedItem}>
              <Text style={styles.itemNumber}>1.</Text>
              <Text style={styles.itemContent}>{String(val)}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Burn Fluid Resuscitation</Text></View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>Burn Fluid Resuscitation Record {idx + 1}</Text>
              {record.createdAt && <Text style={styles.recordMeta}>Date: {formatDate(record.createdAt)}</Text>}
            </View>

            {/* Burn Overview */}
            {renderFieldSection('Burn Overview', [
              ['TBSA %', num(record.tbsaBurnPercentage, '%')],
              ['Burn Depth Classification', hasValue(record.burnDepthClassification) ? String(record.burnDepthClassification) : null],
            ])}

            {/* Fluid Resuscitation Formulas */}
            {renderFieldSection('Fluid Resuscitation Formulas', [
              ['Parkland Formula', num(record.parklandFormulaCalculation, 'mL')],
              ['Modified Brooke Formula', num(record.modifiedBrookeFormulaVolume, 'mL')],
              ['First 8-Hour Volume', num(record.firstEightHourVolume, 'mL')],
              ['Second 16-Hour Volume', num(record.secondSixteenHourVolume, 'mL')],
              ["Lactated Ringer's Volume", num(record.lactatedRingersVolume, 'mL')],
            ])}

            {/* Colloid / Albumin */}
            {renderFieldSection('Colloid / Albumin', [
              ['Colloid Initiation Time', num(record.colloidInitiationTime, 'hrs post-burn')],
              ['Albumin Dose', num(record.albuminDoseCalculation, 'mL')],
            ])}

            {/* Urine Output Targets */}
            {renderFieldSection('Urine Output Targets', [
              ['Hourly Urine Output Target', num(record.hourlyUrineOutputTarget, 'mL/kg/hr')],
              ['Current Urine Output', num(record.currentUrineOutput, 'mL/hr')],
            ])}

            {/* Hemodynamic Monitoring */}
            {renderFieldSection('Hemodynamic Monitoring', [
              ['MAP Target', num(record.meanArterialPressureTarget, 'mmHg')],
              ['Central Venous Pressure', num(record.centralVenousPressure, 'mmHg')],
              ['Abdominal Compartment Pressure', num(record.abdominalCompartmentPressure, 'mmHg')],
            ])}

            {/* Perfusion Markers */}
            {renderFieldSection('Perfusion Markers', [
              ['Serum Lactate', num(record.serumLactateLevel, 'mmol/L')],
              ['Base Deficit', hasValue(record.baseDeficit) && record.baseDeficit !== 0 ? `${record.baseDeficit} mmol/L` : null],
              ['Hematocrit %', num(record.hematocritLevel, '%')],
            ])}

            {/* Resuscitation Status */}
            {renderFieldSection('Resuscitation Status', [
              ['Time From Burn to Resuscitation', num(record.timeFromBurnToResuscitation, 'hrs')],
              ['Cumulative Fluid Balance', num(record.cumulativeFluidBalance, 'mL')],
              ['Fluid Creep Indicator', yn(record.fluidCreepIndicator)],
              ['Inhalation Injury Present', yn(record.inhalationInjuryPresent)],
              ['Escharotomy Performed', yn(record.escharotomyPerformed)],
              ['Vasopressor Requirement', yn(record.vasopressorRequirement)],
              ['Plasma Exchange Indicated', yn(record.plasmaExchangeIndicated)],
              ['High-Dose Ascorbic Acid Protocol', yn(record.ascorbicAcidProtocol)],
            ])}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default BurnFluidResuscitationDocumentPDFTemplate;
