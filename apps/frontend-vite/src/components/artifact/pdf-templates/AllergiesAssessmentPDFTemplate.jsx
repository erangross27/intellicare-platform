import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * AllergiesAssessmentPDFTemplate
 * December 2025 Standards:
 * - Helvetica font, fontSize 12
 * - wrap={false} only on section titles for keep-with-next
 * - Natural page breaks for content
 * - Numbered lists (not bullets)
 * - Bar chart visualization for specificIgE with IgE class levels (0-6)
 * - Allergen categorization (Molds/Fungi, Environmental, Animals, Pollens, Foods)
 */

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    lineHeight: 1.6,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#000000',
    borderBottomWidth: 2,
    borderBottomColor: '#333333',
    borderBottomStyle: 'solid',
    paddingBottom: 12,
  },
  recordContainer: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    borderBottomStyle: 'solid',
  },
  recordHeader: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#000000',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 4,
  },
  recordDate: {
    fontSize: 11,
    color: '#666666',
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    backgroundColor: '#fafafa',
    padding: 8,
    borderWidth: 1,
    borderColor: '#cccccc',
    marginBottom: 6,
  },
  miniCard: {
    backgroundColor: '#ffffff',
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#cccccc',
  },
  miniCardLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  miniCardValue: {
    fontSize: 12,
    color: '#333333',
    lineHeight: 1.5,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  label: {
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginRight: 8,
    fontSize: 11,
  },
  value: {
    color: '#333333',
    flex: 1,
    fontSize: 12,
  },
  text: {
    fontSize: 12,
    marginBottom: 6,
    color: '#333333',
    lineHeight: 1.5,
  },
  listItem: {
    fontSize: 12,
    marginBottom: 6,
    marginLeft: 12,
    color: '#333333',
    lineHeight: 1.5,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 20,
    right: 40,
    fontSize: 10,
    color: '#9ca3af',
  },
  // Chart styles
  chartSection: {
    backgroundColor: '#fafafa',
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#cccccc',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    borderBottomStyle: 'solid',
    flexWrap: 'wrap',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 4,
  },
  legendText: {
    fontSize: 8,
    color: '#666666',
  },
  categoryHeader: {
    backgroundColor: '#e5e7eb',
    padding: 8,
    marginBottom: 8,
    marginTop: 10,
  },
  categoryTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  barRow: {
    marginBottom: 10,
    padding: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  barLabelRow: {
    flexDirection: 'column',
    marginBottom: 6,
  },
  barLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    marginBottom: 2,
  },
  barDescription: {
    fontSize: 9,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 18,
  },
  barBackground: {
    flex: 1,
    height: 14,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  barValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    marginLeft: 8,
    width: 100,
    textAlign: 'right',
  },
});

// Helper to filter null/empty values
const filterNulls = (arr) => (arr || []).filter(item => item !== null && item !== undefined && item !== '');

// Format date helper
const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return String(dateString);
  }
};

// Check if value exists
const hasValue = (val) => {
  if (val === null || val === undefined || val === '') return false;
  if (typeof val === 'object' && !Array.isArray(val)) {
    return Object.keys(val).length > 0 && Object.values(val).some(v => v !== null && v !== undefined && v !== '');
  }
  if (Array.isArray(val)) return val.length > 0;
  return true;
};

// IgE Class color coding (0-6 scale)
const getIgEClassColor = (classLevel) => {
  const level = parseInt(classLevel, 10);
  if (isNaN(level) || level === 0) return '#898989'; // Green - Negative
  if (level === 1) return '#7a7a7a'; // Blue - Low
  if (level === 2) return '#b0b0b0'; // Yellow - Moderate
  if (level === 3) return '#909090'; // Orange - Positive
  return '#777777'; // Red - Strongly positive (Class 4+)
};

// Get IgE Class interpretation
const getIgEClassInterpretation = (classLevel) => {
  const level = parseInt(classLevel, 10);
  if (isNaN(level) || level === 0) return 'Negative';
  if (level === 1) return 'Low';
  if (level === 2) return 'Moderate';
  if (level === 3) return 'Positive';
  if (level === 4) return 'Strongly Positive';
  if (level === 5) return 'Very High';
  if (level === 6) return 'Extremely High';
  return 'Very High';
};

// Categorize allergen for grouping
const categorizeAllergen = (allergen) => {
  const lowerAllergen = allergen.toLowerCase();

  // Molds/Fungi
  if (lowerAllergen.includes('aspergillus') || lowerAllergen.includes('penicillium') ||
      lowerAllergen.includes('cladosporium') || lowerAllergen.includes('alternaria') ||
      lowerAllergen.includes('mold') || lowerAllergen.includes('fungi')) {
    return 'Molds/Fungi';
  }

  // Environmental
  if (lowerAllergen.includes('dust') || lowerAllergen.includes('mite') ||
      lowerAllergen.includes('cockroach') || lowerAllergen.includes('latex')) {
    return 'Environmental';
  }

  // Animals
  if (lowerAllergen.includes('cat') || lowerAllergen.includes('dog') ||
      lowerAllergen.includes('horse') || lowerAllergen.includes('dander') ||
      lowerAllergen.includes('rodent') || lowerAllergen.includes('mouse') ||
      lowerAllergen.includes('rat') || lowerAllergen.includes('feather')) {
    return 'Animals';
  }

  // Pollens
  if (lowerAllergen.includes('pollen') || lowerAllergen.includes('grass') ||
      lowerAllergen.includes('tree') || lowerAllergen.includes('ragweed') ||
      lowerAllergen.includes('weed') || lowerAllergen.includes('birch') ||
      lowerAllergen.includes('oak') || lowerAllergen.includes('cedar')) {
    return 'Pollens';
  }

  // Foods
  if (lowerAllergen.includes('peanut') || lowerAllergen.includes('nut') ||
      lowerAllergen.includes('milk') || lowerAllergen.includes('egg') ||
      lowerAllergen.includes('wheat') || lowerAllergen.includes('soy') ||
      lowerAllergen.includes('fish') || lowerAllergen.includes('shellfish') ||
      lowerAllergen.includes('shrimp') || lowerAllergen.includes('sesame')) {
    return 'Foods';
  }

  return 'Other';
};

// Get allergen description
const getAllergenDescription = (allergen) => {
  const lowerAllergen = allergen.toLowerCase();

  // Molds
  if (lowerAllergen.includes('aspergillus')) return 'Common indoor mold found in damp areas';
  if (lowerAllergen.includes('penicillium')) return 'Mold found on food and in damp buildings';
  if (lowerAllergen.includes('cladosporium')) return 'Outdoor mold common on plants and soil';
  if (lowerAllergen.includes('alternaria')) return 'Outdoor mold, peak in late summer/fall';

  // Environmental
  if (lowerAllergen.includes('dust mite')) return 'Microscopic organisms in household dust';
  if (lowerAllergen.includes('cockroach')) return 'Common indoor allergen in urban areas';

  // Animals
  if (lowerAllergen.includes('cat')) return 'Proteins in cat saliva, skin, and urine';
  if (lowerAllergen.includes('dog')) return 'Proteins in dog saliva, skin, and dander';

  // Pollens
  if (lowerAllergen.includes('grass')) return 'Seasonal allergen, peaks late spring/summer';
  if (lowerAllergen.includes('ragweed')) return 'Common fall allergen in North America';

  // Foods
  if (lowerAllergen.includes('peanut')) return 'Legume, common cause of food anaphylaxis';
  if (lowerAllergen.includes('milk')) return 'Cow\'s milk protein allergy';
  if (lowerAllergen.includes('egg')) return 'Often outgrown in childhood';

  return '';
};

// Group chart data by category
const groupByCategory = (chartData) => {
  const groups = {};
  chartData.forEach(item => {
    if (!groups[item.category]) {
      groups[item.category] = [];
    }
    groups[item.category].push(item);
  });

  // Define category order for consistent display
  const categoryOrder = ['Molds/Fungi', 'Environmental', 'Pollens', 'Foods', 'Animals', 'Other'];

  return categoryOrder
    .filter(cat => groups[cat])
    .map(cat => ({
      category: cat,
      items: groups[cat]
    }));
};

// Parse specificIgE to chart data
const parseSpecificIgEToChartData = (specificIgE) => {
  if (!specificIgE || typeof specificIgE !== 'object') return [];

  const chartData = [];
  Object.entries(specificIgE).forEach(([allergen, data]) => {
    if (!data) return;

    let classLevel = 0;
    let level = '';
    let interpretation = '';

    if (typeof data === 'object') {
      classLevel = parseInt(data.class, 10) || 0;
      level = String(data.level || '');
      interpretation = String(data.interpretation || getIgEClassInterpretation(classLevel));
    } else if (typeof data === 'string') {
      // Try to parse if it's a string like "Class 3" or just "3"
      const classMatch = data.match(/class\s*(\d+)/i) || data.match(/^(\d+)$/);
      if (classMatch) {
        classLevel = parseInt(classMatch[1], 10);
        interpretation = getIgEClassInterpretation(classLevel);
      }
    }

    chartData.push({
      allergen,
      classLevel,
      level,
      interpretation,
      color: getIgEClassColor(classLevel),
      category: categorizeAllergen(allergen),
      description: getAllergenDescription(allergen)
    });
  });

  // Sort by class level descending within each category
  return chartData.sort((a, b) => b.classLevel - a.classLevel);
};

// PDF Legend Component
const PDFLegend = () => (
  <View style={styles.legendContainer}>
    <View style={styles.legendItem}>
      <View style={[styles.legendColor, { backgroundColor: '#898989' }]} />
      <Text style={styles.legendText}>Class 0 - Negative</Text>
    </View>
    <View style={styles.legendItem}>
      <View style={[styles.legendColor, { backgroundColor: '#7a7a7a' }]} />
      <Text style={styles.legendText}>Class 1 - Low</Text>
    </View>
    <View style={styles.legendItem}>
      <View style={[styles.legendColor, { backgroundColor: '#b0b0b0' }]} />
      <Text style={styles.legendText}>Class 2 - Moderate</Text>
    </View>
    <View style={styles.legendItem}>
      <View style={[styles.legendColor, { backgroundColor: '#909090' }]} />
      <Text style={styles.legendText}>Class 3 - Positive</Text>
    </View>
    <View style={styles.legendItem}>
      <View style={[styles.legendColor, { backgroundColor: '#777777' }]} />
      <Text style={styles.legendText}>Class 4+ - Strongly Positive</Text>
    </View>
  </View>
);

// PDF Bar Chart Row Component
const PDFBarChartRow = ({ item }) => {
  const percentage = (item.classLevel / 6) * 100;

  return (
    <View style={styles.barRow}>
      <View style={styles.barLabelRow}>
        <Text style={styles.barLabel}>{String(item.allergen)}</Text>
        {item.description && (
          <Text style={styles.barDescription}>{String(item.description)}</Text>
        )}
      </View>
      <View style={styles.barContainer}>
        <View style={styles.barBackground}>
          <View style={[styles.barFill, { width: `${percentage}%`, backgroundColor: item.color }]} />
        </View>
        <Text style={styles.barValue}>
          Class {item.classLevel} {item.level ? `(${item.level})` : ''} - {String(item.interpretation)}
        </Text>
      </View>
    </View>
  );
};

const AllergiesAssessmentPDFTemplate = ({ document: doc }) => {
  // Handle both array and object input
  let records = [];

  if (Array.isArray(doc)) {
    records = doc;
  } else if (doc?.allergy_assessments) {
    records = doc.allergy_assessments;
  } else if (doc) {
    records = [doc];
  }

  // Filter valid records
  records = filterNulls(records).filter(record =>
    record && (
      hasValue(record.specificIgE) ||
      hasValue(record.environmentalAllergens) ||
      hasValue(record.skinTestResults) ||
      hasValue(record.totalIge) ||
      hasValue(record.provider)
    )
  );

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.title}>Allergies Assessment</Text>
          <Text style={styles.text}>No allergy assessment data available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Allergies Assessment</Text>

        {records.map((record, idx) => {
          // Parse specificIgE data for bar chart
          const chartData = parseSpecificIgEToChartData(record.specificIgE);
          const groupedChartData = groupByCategory(chartData);
          const hasChartData = chartData.length > 0;

          return (
            <View key={idx} style={styles.recordContainer}>
              {/* Record Header - Keep with next */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>
                  {idx + 1}. Allergy Assessment
                </Text>
                {record.date && (
                  <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                )}
              </View>

              {/* Assessment Information */}
              {(hasValue(record.provider) || hasValue(record.source) || hasValue(record.totalIge) || hasValue(record.eosinophilCount)) && (
                <View style={styles.sectionContent} wrap={false}>
                  <Text style={styles.sectionTitle}>Assessment Information</Text>
                  {hasValue(record.provider) && (
                    <View style={styles.miniCard}>
                      <Text style={styles.miniCardLabel}>Provider</Text>
                      <Text style={styles.miniCardValue}>{String(record.provider)}</Text>
                    </View>
                  )}
                  {hasValue(record.source) && (
                    <View style={styles.miniCard}>
                      <Text style={styles.miniCardLabel}>Source</Text>
                      <Text style={styles.miniCardValue}>{String(record.source)}</Text>
                    </View>
                  )}
                  {hasValue(record.totalIge) && (
                    <View style={styles.miniCard}>
                      <Text style={styles.miniCardLabel}>Total IgE</Text>
                      <Text style={styles.miniCardValue}>{String(record.totalIge)}</Text>
                    </View>
                  )}
                  {hasValue(record.eosinophilCount) && (
                    <View style={styles.miniCard}>
                      <Text style={styles.miniCardLabel}>Eosinophil Count</Text>
                      <Text style={styles.miniCardValue}>{String(record.eosinophilCount)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Specific IgE Bar Chart */}
              {hasChartData && (
                <View style={styles.chartSection} wrap={chartData.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Specific IgE Results</Text>
                  <PDFLegend />
                  {groupedChartData.map((group, gIdx) => (
                    <View key={gIdx}>
                      <View style={styles.categoryHeader}>
                        <Text style={styles.categoryTitle}>{String(group.category)}</Text>
                      </View>
                      {group.items.map((item, iIdx) => (
                        <PDFBarChartRow key={iIdx} item={item} />
                      ))}
                    </View>
                  ))}
                </View>
              )}

              {/* Environmental Allergens - Only show if NO chart data (avoid duplicates) */}
              {!hasChartData && hasValue(record.environmentalAllergens) && filterNulls(record.environmentalAllergens).length > 0 && (() => {
                const items = filterNulls(record.environmentalAllergens);
                return (
                  <View style={styles.sectionContent} wrap={items.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Environmental Allergens</Text>
                    {items.map((allergen, aIdx) => (
                      <View key={aIdx} style={styles.miniCard}>
                        <Text style={styles.miniCardLabel}>
                          {aIdx + 1}. {typeof allergen === 'string' ? allergen : String(allergen.allergen || allergen.name || 'Allergen')}
                        </Text>
                        {typeof allergen === 'object' && (
                          <Text style={styles.miniCardValue}>
                            {allergen.igeLevel && `IgE Level: ${String(allergen.igeLevel)}`}
                            {allergen.severity && ` | Severity: ${String(allergen.severity)}`}
                            {allergen.reaction && ` | Reaction: ${String(allergen.reaction)}`}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                );
              })()}

              {/* Skin Test Results - Only show if NO chart data (avoid duplicates) */}
              {!hasChartData && hasValue(record.skinTestResults) && (() => {
                const skinItems = Array.isArray(record.skinTestResults)
                  ? filterNulls(record.skinTestResults)
                  : typeof record.skinTestResults === 'object'
                    ? Object.entries(record.skinTestResults).filter(([, v]) => hasValue(v))
                    : [record.skinTestResults];
                return (
                  <View style={styles.sectionContent} wrap={skinItems.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Skin Test Results</Text>
                    {typeof record.skinTestResults === 'object' && !Array.isArray(record.skinTestResults) ? (
                      Object.entries(record.skinTestResults).filter(([, v]) => hasValue(v)).map(([key, value], sIdx) => {
                        const formattedKey = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
                        return (
                          <View key={sIdx} style={styles.miniCard}>
                            <Text style={styles.miniCardLabel}>{sIdx + 1}. {formattedKey}</Text>
                            <Text style={styles.miniCardValue}>{String(value)}</Text>
                          </View>
                        );
                      })
                    ) : Array.isArray(record.skinTestResults) ? (
                      filterNulls(record.skinTestResults).map((result, sIdx) => (
                        <View key={sIdx} style={styles.miniCard}>
                          <Text style={styles.miniCardValue}>
                            {sIdx + 1}. {typeof result === 'string' ? result : String(result.allergen || result.name || JSON.stringify(result))}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <View style={styles.miniCard}>
                        <Text style={styles.miniCardValue}>{String(record.skinTestResults)}</Text>
                      </View>
                    )}
                  </View>
                );
              })()}

              {/* Recommendations */}
              {hasValue(record.recommendations) && filterNulls(record.recommendations).length > 0 && (() => {
                const recs = filterNulls(record.recommendations);
                return (
                  <View style={styles.sectionContent} wrap={recs.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Recommendations</Text>
                    {recs.map((rec, rIdx) => (
                      <View key={rIdx} style={styles.miniCard}>
                        {typeof rec === 'object' ? (
                          <>
                            {rec.date && (
                              <Text style={styles.miniCardLabel}>{formatDate(rec.date)}</Text>
                            )}
                            <Text style={styles.miniCardValue}>{rIdx + 1}. {String(rec.recommendation || '')}</Text>
                          </>
                        ) : (
                          <Text style={styles.miniCardValue}>{rIdx + 1}. {String(rec)}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                );
              })()}

              {/* Notes */}
              {hasValue(record.notes) && (
                <View style={styles.sectionContent} wrap={false}>
                  <Text style={styles.sectionTitle}>Notes</Text>
                  <View style={styles.miniCard}>
                    <Text style={styles.miniCardValue}>{String(record.notes)}</Text>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
};

export default AllergiesAssessmentPDFTemplate;
