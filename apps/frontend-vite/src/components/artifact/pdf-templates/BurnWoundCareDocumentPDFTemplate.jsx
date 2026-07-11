import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Burn Wound Care Document PDF Template - February 2026
 * Helvetica font, professional layout, A4
 * Nested subtitle format: label on own line, value indented below
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
  nestedSubtitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    paddingLeft: 12,
    marginBottom: 2,
    marginTop: 6,
  },
  valueText: {
    fontSize: 12,
    color: '#000000',
    paddingLeft: 24,
    marginBottom: 6,
    lineHeight: 1.4,
  },
  numberedItem: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 24,
  },
  itemNumber: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    width: 24,
  },
  itemContent: {
    fontSize: 12,
    color: '#000000',
    flex: 1,
    lineHeight: 1.4,
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

// parseSubtitleItems: splits "Label1: value1. Label2: value2." into [{label, value, isGeneric}]
const parseSubtitleItems = (text) => {
  if (!text) return [];
  const segments = text.split(/(?<!(?:Dr|Mr|Mrs|Ms|Jr|Sr|St|vs|etc)\.)(?<=\.)\s+(?=[A-Z])/).filter(s => s.trim());
  if (segments.length === 0) return [];
  return segments.map((segment) => {
    const colonMatch = segment.match(/^([^:]+?):\s*(.+)$/s);
    if (colonMatch && colonMatch[1].length < 80) {
      return { label: colonMatch[1].trim(), value: colonMatch[2].trim().replace(/\.$/, ''), isGeneric: false };
    }
    return { label: '', value: segment.trim().replace(/\.$/, ''), isGeneric: true };
  });
};

const BurnWoundCareDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (Array.isArray(templateData)) return templateData;
    if (templateData?.burn_wound_care) return templateData.burn_wound_care;
    if (templateData?.documentData) {
      const docData = templateData.documentData;
      if (Array.isArray(docData)) return docData;
      if (docData?.burn_wound_care) return docData.burn_wound_care;
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
            <Text style={styles.documentTitle}>Burn Wound Care</Text>
          </View>
          <Text style={styles.noData}>No burn wound care data available</Text>
        </Page>
      </Document>
    );
  }

  // Render field section - nested subtitle format (label on own line, value below)
  const renderFieldSection = (title, entries) => {
    const valid = entries
      .filter(([, val]) => typeof val === 'boolean' ? true : hasValue(val))
      .map(([label, val]) => [label, typeof val === 'boolean' ? (val ? 'Yes' : 'No') : safeString(val)]);
    if (valid.length === 0) return null;
    return (
      <View style={styles.section} wrap={valid.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {valid.map(([label, val], i) => {
          const subItems = parseSubtitleItems(val);
          if (subItems.length > 1) {
            return (
              <View key={i}>
                <Text style={styles.nestedSubtitle}>{label}</Text>
                {subItems.map((item, j) => {
                  const commaItems = item.value.split(/,\s*/).filter(s => s.trim());
                  return (
                    <View key={j} style={{ marginBottom: 4 }}>
                      {!item.isGeneric && (
                        <Text style={[styles.nestedSubtitle, { paddingLeft: 24 }]}>{item.label}</Text>
                      )}
                      {commaItems.length > 1 ? (
                        commaItems.map((ci, k) => (
                          <View key={k} style={[styles.numberedItem, { paddingLeft: 36 }]}>
                            <Text style={styles.itemNumber}>{k + 1}.</Text>
                            <Text style={styles.itemContent}>{ci.trim()}</Text>
                          </View>
                        ))
                      ) : (
                        <View style={[styles.numberedItem, { paddingLeft: 36 }]}>
                          <Text style={styles.itemNumber}>1.</Text>
                          <Text style={styles.itemContent}>{item.value}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          }
          const topCommaItems = val.split(/,(?![^(]*\))/).map(s => s.trim()).filter(s => s);
          if (topCommaItems.length > 1) {
            return (
              <View key={i}>
                <Text style={styles.nestedSubtitle}>{label}</Text>
                {topCommaItems.map((ci, k) => (
                  <View key={k} style={styles.numberedItem}>
                    <Text style={styles.itemNumber}>{k + 1}.</Text>
                    <Text style={styles.itemContent}>{ci}</Text>
                  </View>
                ))}
              </View>
            );
          }
          return (
            <View key={i}>
              <Text style={styles.nestedSubtitle}>{label}</Text>
              <View style={styles.numberedItem}>
                <Text style={styles.itemNumber}>1.</Text>
                <Text style={styles.itemContent}>{val}</Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  // Render array section (numbered list)
  const renderArraySection = (title, items) => {
    const safeItems = safeArray(items);
    if (safeItems.length === 0) return null;
    return (
      <View style={styles.section} wrap={safeItems.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {safeItems.map((item, i) => (
          <View key={i} style={styles.numberedItem}>
            <Text style={styles.itemNumber}>{i + 1}.</Text>
            <Text style={styles.itemContent}>{safeString(item)}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Burn Wound Care</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} minPresenceAhead={80}>
            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>Burn Wound Care Record {idx + 1}</Text>
              {record.createdAt && (
                <Text style={styles.recordMeta}>Date: {formatDate(record.createdAt)}</Text>
              )}
            </View>

            {/* 0. Provider Information */}
            {renderFieldSection('Provider Information', [
              ['Provider', record.provider],
              ['Facility', record.facility],
            ])}

            {/* 1. Burn Overview */}
            {renderFieldSection('Burn Overview', [
              ['TBSA', hasValue(record.burnTotalBodySurfaceArea) ? `${record.burnTotalBodySurfaceArea}%` : null],
              ['Burn Depth Classification', record.burnDepthClassification],
            ])}

            {/* 2. Severity Scoring */}
            {renderFieldSection('Severity Scoring', [
              ['Lund-Browder Score', hasValue(record.lundBrowderScore) ? String(record.lundBrowderScore) : null],
              ['Baxter/Parkland Formula', hasValue(record.baxterParklandFormula) ? `${record.baxterParklandFormula} mL` : null],
              ['Modified Baux Score', hasValue(record.modifiedBauxScore) ? String(record.modifiedBauxScore) : null],
              ['Abbreviated Burn Severity Index', hasValue(record.abbreviatedBurnSeverityIndex) ? String(record.abbreviatedBurnSeverityIndex) : null],
            ])}

            {/* 3. Inhalation Injury */}
            {renderFieldSection('Inhalation Injury', [
              ['Inhalation Injury Grade', record.inhalationInjuryGrade],
              ['Carboxyhemoglobin Level', hasValue(record.carboxyhemoglobinLevel) ? `${record.carboxyhemoglobinLevel}%` : null],
            ])}

            {/* 4. Escharotomy */}
            {renderFieldSection('Escharotomy', [
              ['Escharotomy Required', record.escharotomyRequired],
            ])}

            {/* 5. Escharotomy Locations */}
            {renderArraySection('Escharotomy Locations', record.escharotomyLocations)}

            {/* 6. Wound Bed Status — labeled sentence parsing */}
            {record.woundBedPreparationStatus && (() => {
              const sentences = String(record.woundBedPreparationStatus).split(/\.\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0);
              if (sentences.length <= 1) return renderFieldSection('Wound Bed Status', [['Wound Bed Preparation Status', record.woundBedPreparationStatus]]);
              return (<View style={styles.section} wrap={sentences.length > 8 ? undefined : false}><Text style={styles.sectionTitle}>Wound Bed Status</Text>{sentences.map((s, si) => {
                const colonIdx = s.indexOf(':');
                if (colonIdx > 0 && colonIdx < 60) {
                  const label = s.substring(0, colonIdx).trim();
                  const rest = s.substring(colonIdx + 1).trim().replace(/\.$/, '');
                  const items = rest.split(/,\s*/).filter(i => i.trim());
                  return (<View key={si} style={{ marginBottom: 8 }}><Text style={styles.nestedSubtitle}>{label}</Text>{items.map((item, ii) => (<View key={ii} style={styles.numberedItem}><Text style={styles.itemNumber}>{ii + 1}.</Text><Text style={styles.itemContent}>{item.trim()}</Text></View>))}</View>);
                }
                return <Text key={si} style={styles.valueText}>{s.replace(/\.$/, '')}</Text>;
              })}</View>);
            })()}

            {/* 6b. Wound Assessment — remaining fields */}
            {renderFieldSection('Wound Assessment', [
              ['Debridement Method', record.debridementMethod],
              ['Topical Antimicrobial Agent', record.topicalAntimicrobialAgent],
              ['Burn Wound Culture Results', record.burnWoundCultureResults],
              ['Quantitative Wound Biopsy', hasValue(record.quantitativeWoundBiopsy) ? `${record.quantitativeWoundBiopsy} CFU/g` : null],
            ])}

            {/* 7. Grafting */}
            {renderFieldSection('Grafting', [
              ['Skin Graft Type', record.skinGraftType],
              ['Graft Mesh Ratio', record.graftMeshRatio],
              ['Graft Take Percentage', hasValue(record.graftTakePercentage) ? `${record.graftTakePercentage}%` : null],
              ['Dermal Substitute Placed', record.dermalSubstitutePlaced],
            ])}

            {/* 8. Wound Therapy */}
            {renderFieldSection('Wound Therapy', [
              ['Negative Pressure Wound Therapy Settings', record.negativeProressureWoundTherapySettings],
            ])}

            {/* 9. Nutritional Support */}
            {renderFieldSection('Nutritional Support', [
              ['Prealbumin Level', hasValue(record.prealabuminLevel) ? `${record.prealabuminLevel} mg/dL` : null],
              ['Curreri Formula Calories', hasValue(record.curreriFormulaCalories) ? `${record.curreriFormulaCalories} kcal/day` : null],
            ])}

            {/* 10. Scar Management */}
            {renderFieldSection('Scar Management', [
              ['Vancouver Scar Scale Score', hasValue(record.vancouverScarScaleScore) ? String(record.vancouverScarScaleScore) : null],
              ['Pressure Garment Compliance', record.pressureGarmentCompliance],
            ])}

            {/* 11. Contracture Locations */}
            {renderArraySection('Contracture Locations', record.contractureLocation)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default BurnWoundCareDocumentPDFTemplate;
