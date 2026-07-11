import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * NutritionAssessmentsDocumentPDFTemplate - December 2025 Standards
 *
 * - Helvetica font (NOT Courier!)
 * - Bar chart visualization for nutrition metrics
 * - wrap={false} on sections to prevent orphaned headers
 * - All values wrapped in String() to prevent crashes
 */

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    padding: 30,
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#333333'
  },
  header: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: '2px solid #606060'
  },
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    color: '#363636'
  },
  subtitle: {
    fontSize: 10,
    color: '#666666',
    marginBottom: 2
  },
  recordContainer: {
    marginBottom: 16
  },
  recordHeader: {
    backgroundColor: '#f0f7ff',
    padding: 8,
    marginBottom: 10,
    borderRadius: 4,
    borderLeft: '3px solid #606060'
  },
  recordTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#363636',
    marginBottom: 4
  },
  recordMeta: {
    fontSize: 9,
    color: '#666666'
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginTop: 10,
    marginBottom: 6,
    color: '#606060',
    paddingBottom: 2,
    borderBottom: '1px solid #e5e7eb'
  },
  fieldRow: {
    marginBottom: 3,
    marginLeft: 8,
    fontSize: 10
  },
  fieldLabel: {
    fontFamily: 'Helvetica-Bold',
    color: '#333333'
  },
  textBlock: {
    fontSize: 10,
    marginBottom: 6,
    marginLeft: 8,
    lineHeight: 1.5,
    color: '#333333'
  },
  listItem: {
    fontSize: 10,
    marginBottom: 3,
    marginLeft: 16,
    color: '#333333'
  },
  separator: {
    marginTop: 12,
    marginBottom: 6,
    borderBottom: '1px solid #e5e7eb'
  },
  emptyLine: {
    marginBottom: 6
  }
});

// Chart styles for bar chart visualization
const chartStyles = StyleSheet.create({
  chartSection: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    border: '1px solid #e2e8f0'
  },
  chartTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#606060',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: '1px solid #e5e7eb'
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8,
    paddingBottom: 6,
    borderBottom: '1px solid #e5e7eb'
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10
  },
  legendColor: {
    width: 10,
    height: 10,
    borderRadius: 2,
    marginRight: 4
  },
  legendText: {
    fontSize: 8,
    color: '#666666'
  },
  categoryHeader: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#727272',
    marginTop: 6,
    marginBottom: 6,
    paddingLeft: 6,
    borderLeft: '2px solid #7a7a7a'
  },
  barChartRow: {
    marginBottom: 8
  },
  barLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    marginBottom: 3
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 14
  },
  barBackground: {
    flex: 1,
    height: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden'
  },
  barFill: {
    height: '100%',
    borderRadius: 3
  },
  barValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    marginLeft: 6,
    width: 70,
    textAlign: 'right'
  },
  barInterpretation: {
    fontSize: 8,
    marginTop: 2,
    marginLeft: 4
  }
});

const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (e) {
    return String(dateString);
  }
};

// ========== NUTRITION METRIC EXTRACTION FUNCTIONS ==========

const extractBMI = (text) => {
  if (!text) return null;
  const str = String(text);
  // Try "BMI 24.7 kg/m²" or "BMI: 24.7" or "BMI 24.7"
  const match = str.match(/BMI[:\s]+(\d+(?:\.\d+)?)/i) ||
                str.match(/BMI\s+(\d+(?:\.\d+)?)\s*kg/i);
  return match ? parseFloat(match[1]) : null;
};

const extractWeight = (text) => {
  if (!text) return null;
  const str = String(text);
  // Try "weight 75 kg" or "weight: 75" or "75 kg"
  const match = str.match(/weight\s+(\d+(?:\.\d+)?)\s*kg/i) ||
                str.match(/(?:weight[:\s]+)?(\d+(?:\.\d+)?)\s*(?:kg|kilograms?)/i) ||
                str.match(/weight[:\s]+(\d+(?:\.\d+)?)/i);
  return match ? parseFloat(match[1]) : null;
};

const extractCalories = (text) => {
  if (!text) return null;
  const str = String(text);
  // Try "2,875 kcal/day" or "Calories ~2800-3200/day" or "2875 kcal"
  const rangeMatch = str.match(/Calories?\s*~?\s*(\d{1,3}(?:,\d{3})*)\s*[-–]\s*(\d{1,3}(?:,\d{3})*)/i);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1].replace(/,/g, ''));
    const high = parseFloat(rangeMatch[2].replace(/,/g, ''));
    return (low + high) / 2; // Return average
  }
  const match = str.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:kcal|calories?)/i) ||
                str.match(/caloric\s*(?:needs?|requirements?|intake)[:\s]+(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/i) ||
                str.match(/=\s*(\d{1,3}(?:,\d{3})*)\s*kcal/i);
  if (match) {
    return parseFloat(match[1].replace(/,/g, ''));
  }
  return null;
};

const extractProtein = (text) => {
  if (!text) return null;
  const str = String(text);
  // Try "150-188 g/day" or "protein: 60-80g" or "~40g/day"
  const rangeMatch = str.match(/(?:protein[:\s]+)?(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*g(?:\/day)?/i) ||
                     str.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*g(?:\/day)?\s*(?:protein|of\s+protein)/i);
  if (rangeMatch) {
    return (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2;
  }
  // Try "~40g/day" or "protein ~40g" or "60g protein"
  const singleMatch = str.match(/protein[:\s]+~?(\d+(?:\.\d+)?)\s*g/i) ||
                      str.match(/~(\d+)\s*g(?:\/day)?,?\s*(?:goal|protein)?/i) ||
                      str.match(/(\d+(?:\.\d+)?)\s*g(?:\/day)?\s*(?:of\s+)?protein/i);
  return singleMatch ? parseFloat(singleMatch[1]) : null;
};

const getBMIColor = (bmi) => {
  if (bmi < 18.5) return '#7a7a7a';
  if (bmi < 25) return '#898989';
  if (bmi < 30) return '#a7a7a7';
  return '#777777';
};

const getBMIInterpretation = (bmi) => {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  if (bmi < 35) return 'Obese Class I';
  if (bmi < 40) return 'Obese Class II';
  return 'Obese Class III';
};

// Extract Height from text
const extractHeight = (text) => {
  if (!text) return null;
  const str = String(text);
  // Try "height 178 cm" or "height: 178" or "178 cm"
  const match = str.match(/height\s+(\d+(?:\.\d+)?)\s*cm/i) ||
                str.match(/(?:height[:\s]+)?(\d+(?:\.\d+)?)\s*(?:cm|centimeters?)/i) ||
                str.match(/height[:\s]+(\d+(?:\.\d+)?)/i);
  return match ? parseFloat(match[1]) : null;
};

const prepareChartData = (record) => {
  const charts = [];
  // Combine all text sources for metric extraction
  const findingsText = `${String(record.findings || '')} ${String(record.assessment || '')} ${String(record.plan || '')}`;

  // Also check results object directly for structured data
  const results = record.results || {};

  // Extract BMI - try results object first, then text
  let bmi = null;
  if (results['Current BMI'] || results['BMI'] || results.bmi) {
    const bmiVal = results['Current BMI'] || results['BMI'] || results.bmi;
    bmi = parseFloat(String(bmiVal).replace(/[^\d.]/g, ''));
  }
  if (bmi === null || isNaN(bmi)) {
    bmi = extractBMI(findingsText);
  }

  // Extract Weight - try results object first, then text
  let weight = null;
  if (results['Weight'] || results['Current Weight'] || results.weight) {
    const weightVal = results['Weight'] || results['Current Weight'] || results.weight;
    weight = parseFloat(String(weightVal).replace(/[^\d.]/g, ''));
  }
  if (weight === null || isNaN(weight)) {
    weight = extractWeight(findingsText);
  }

  // Extract Height - try results object first, then text
  let height = null;
  if (results['Height'] || results.height) {
    const heightVal = results['Height'] || results.height;
    height = parseFloat(String(heightVal).replace(/[^\d.]/g, ''));
  }
  if (height === null || isNaN(height)) {
    height = extractHeight(findingsText);
  }

  // Extract Sodium from results object (e.g., "~3,500 mg/day")
  let sodium = null;
  if (results['Current sodium intake'] || results['Sodium'] || results.sodium) {
    const sodiumVal = results['Current sodium intake'] || results['Sodium'] || results.sodium;
    const match = String(sodiumVal).match(/(\d{1,3}(?:,\d{3})*)/);
    if (match) sodium = parseFloat(match[1].replace(/,/g, ''));
  }

  // Extract Fiber from results object (e.g., "<15 g/day")
  let fiber = null;
  if (results['Current fiber'] || results['Fiber'] || results.fiber) {
    const fiberVal = results['Current fiber'] || results['Fiber'] || results.fiber;
    const match = String(fiberVal).match(/(\d+(?:\.\d+)?)/);
    if (match) fiber = parseFloat(match[1]);
  }

  // Extract Calories
  const calories = extractCalories(findingsText);

  // Extract Protein
  const protein = extractProtein(findingsText);

  // BMI Chart (scale: 15-45)
  if (bmi !== null && !isNaN(bmi)) {
    const percentage = Math.min(100, Math.max(0, ((bmi - 15) / 30) * 100));
    charts.push({
      label: 'BMI (Body Mass Index)',
      rawValue: `${bmi.toFixed(1)} kg/m²`,
      percentage,
      color: getBMIColor(bmi),
      interpretation: getBMIInterpretation(bmi),
      category: 'Anthropometric'
    });
  }

  // Weight Chart (scale: 40-150 kg)
  if (weight !== null && !isNaN(weight)) {
    const percentage = Math.min(100, Math.max(0, ((weight - 40) / 110) * 100));
    charts.push({
      label: 'Weight',
      rawValue: `${weight.toFixed(1)} kg`,
      percentage,
      color: '#9a9a9a',
      interpretation: '',
      category: 'Anthropometric'
    });
  }

  // Height Chart (scale: 140-200 cm)
  if (height !== null && !isNaN(height)) {
    const percentage = Math.min(100, Math.max(0, ((height - 140) / 60) * 100));
    charts.push({
      label: 'Height',
      rawValue: `${height.toFixed(0)} cm`,
      percentage,
      color: '#9a9a9a',
      interpretation: '',
      category: 'Anthropometric'
    });
  }

  // Sodium Chart (scale: 0-5000 mg, AHA guideline <2300mg)
  if (sodium !== null && !isNaN(sodium)) {
    const percentage = Math.min(100, Math.max(0, (sodium / 5000) * 100));
    charts.push({
      label: 'Sodium Intake',
      rawValue: `${sodium.toLocaleString()} mg/day`,
      percentage,
      color: sodium > 2300 ? '#777777' : '#898989',
      interpretation: sodium > 2300 ? 'High (>2300mg)' : 'Normal',
      category: 'Nutritional Requirements'
    });
  }

  // Fiber Chart (scale: 0-50 g, recommendation 25-30g)
  if (fiber !== null && !isNaN(fiber)) {
    const percentage = Math.min(100, Math.max(0, (fiber / 50) * 100));
    charts.push({
      label: 'Fiber Intake',
      rawValue: `${fiber.toFixed(0)} g/day`,
      percentage,
      color: fiber < 25 ? '#a7a7a7' : '#898989',
      interpretation: fiber < 25 ? 'Low (<25g)' : 'Adequate',
      category: 'Nutritional Requirements'
    });
  }

  // Calories Chart (scale: 1000-4000 kcal)
  if (calories !== null && !isNaN(calories)) {
    const percentage = Math.min(100, Math.max(0, ((calories - 1000) / 3000) * 100));
    charts.push({
      label: 'Caloric Needs',
      rawValue: `${calories.toLocaleString()} kcal/day`,
      percentage,
      color: '#a7a7a7',
      interpretation: calories > 2500 ? 'High Energy' : calories > 1800 ? 'Moderate' : 'Low Energy',
      category: 'Nutritional Requirements'
    });
  }

  // Protein Chart (scale: 40-200 g)
  if (protein !== null && !isNaN(protein)) {
    const percentage = Math.min(100, Math.max(0, ((protein - 40) / 160) * 100));
    charts.push({
      label: 'Protein Needs',
      rawValue: `${protein.toFixed(0)} g/day`,
      percentage,
      color: '#7c7c7c',
      interpretation: protein > 100 ? 'High Protein' : protein > 60 ? 'Moderate' : 'Standard',
      category: 'Nutritional Requirements'
    });
  }

  return charts;
};

const groupChartsByCategory = (chartData) => {
  const groups = {};
  chartData.forEach(item => {
    if (!groups[item.category]) {
      groups[item.category] = [];
    }
    groups[item.category].push(item);
  });

  const categoryOrder = ['Anthropometric', 'Nutritional Requirements'];
  return categoryOrder
    .filter(cat => groups[cat])
    .map(cat => ({
      category: cat,
      items: groups[cat]
    }));
};

// PDF Legend Component
const PDFLegend = () => (
  <View style={chartStyles.legendContainer}>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#898989' }]} />
      <Text style={chartStyles.legendText}>Normal</Text>
    </View>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#7a7a7a' }]} />
      <Text style={chartStyles.legendText}>Low</Text>
    </View>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#a7a7a7' }]} />
      <Text style={chartStyles.legendText}>Elevated</Text>
    </View>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#777777' }]} />
      <Text style={chartStyles.legendText}>High Risk</Text>
    </View>
  </View>
);

// PDF Bar Chart Component
const PDFBarChart = ({ label, percentage, rawValue, color, interpretation }) => (
  <View style={chartStyles.barChartRow}>
    <Text style={chartStyles.barLabel}>{String(label)}</Text>
    <View style={chartStyles.barContainer}>
      <View style={chartStyles.barBackground}>
        <View style={[chartStyles.barFill, { width: `${percentage}%`, backgroundColor: color }]} />
      </View>
      <Text style={chartStyles.barValue}>{String(rawValue)}</Text>
    </View>
    {interpretation && (
      <Text style={[chartStyles.barInterpretation, { color }]}>{String(interpretation)}</Text>
    )}
  </View>
);

const NutritionAssessmentsDocumentPDFTemplate = ({ document: templateData }) => {
  // Data unwrapping - same as JSX component
  const data = templateData?.documentData || templateData?.data || templateData;
  let records = [];

  if (Array.isArray(data)) {
    records = data;
  } else if (data?.nutrition_assessments) {
    records = Array.isArray(data.nutrition_assessments) ? data.nutrition_assessments : [data.nutrition_assessments];
  } else if (data?.data) {
    records = Array.isArray(data.data) ? data.data : [data.data];
  }

  const recordsArray = Array.isArray(records) ? records : [records];
  const validRecords = recordsArray.filter(rec => rec && typeof rec === 'object');

  if (validRecords.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>Nutrition Assessments</Text>
            <Text style={styles.subtitle}>No data available</Text>
          </View>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Nutrition Assessments</Text>
          <Text style={styles.subtitle}>Generated: {new Date().toLocaleDateString()}</Text>
          <Text style={styles.subtitle}>Total Records: {validRecords.length}</Text>
        </View>

        {/* Nutrition Assessment Records */}
        {validRecords.map((rec, recIdx) => {
          const chartData = prepareChartData(rec);
          const hasChartData = chartData.length > 0;
          const groupedData = groupChartsByCategory(chartData);

          return (
            <View key={recIdx} style={styles.recordContainer}>
              {/* Record Header */}
              <View style={styles.recordHeader}>
                <Text style={styles.recordTitle}>
                  {String(rec.type || `Nutrition Assessment ${recIdx + 1}`)}
                </Text>
                {(rec.date || rec.status) && (
                  <Text style={styles.recordMeta}>
                    {rec.date && `Date: ${formatDate(rec.date)}`}
                    {rec.date && rec.status && ' | '}
                    {rec.status && `Status: ${String(rec.status)}`}
                  </Text>
                )}
              </View>

              {/* Nutrition Overview - Bar Chart */}
              {hasChartData && (
                <View style={chartStyles.chartSection} wrap={false}>
                  <Text style={chartStyles.chartTitle}>Nutrition Overview</Text>
                  <PDFLegend />
                  {groupedData.map((group, gIdx) => (
                    <View key={gIdx}>
                      <Text style={chartStyles.categoryHeader}>{String(group.category)}</Text>
                      {group.items.map((chart, cIdx) => (
                        <PDFBarChart
                          key={cIdx}
                          label={chart.label}
                          percentage={chart.percentage}
                          rawValue={chart.rawValue}
                          color={chart.color}
                          interpretation={chart.interpretation}
                        />
                      ))}
                    </View>
                  ))}
                </View>
              )}

              {/* Assessment Information */}
              {(rec.type || rec.date || rec.provider || rec.facility || rec.status) && (
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Assessment Information</Text>
                  {rec.type && (
                    <Text style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Type: </Text>
                      {String(rec.type)}
                    </Text>
                  )}
                  {rec.date && (
                    <Text style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Date: </Text>
                      {formatDate(rec.date)}
                    </Text>
                  )}
                  {rec.provider && (
                    <Text style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Provider: </Text>
                      {String(rec.provider)}
                    </Text>
                  )}
                  {rec.facility && (
                    <Text style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Facility: </Text>
                      {String(rec.facility)}
                    </Text>
                  )}
                  {rec.status && (
                    <Text style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Status: </Text>
                      {String(rec.status)}
                    </Text>
                  )}
                  <View style={styles.emptyLine} />
                </View>
              )}

              {/* Dietary Findings */}
              {rec.findings && (
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Dietary Findings</Text>
                  <Text style={styles.textBlock}>{String(rec.findings)}</Text>
                </View>
              )}

              {/* Assessment */}
              {rec.assessment && (
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Assessment</Text>
                  <Text style={styles.textBlock}>{String(rec.assessment)}</Text>
                </View>
              )}

              {/* Nutrition Plan */}
              {rec.plan && (
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Nutrition Plan</Text>
                  <Text style={styles.textBlock}>{String(rec.plan)}</Text>
                </View>
              )}

              {/* Recommendations */}
              {rec.recommendations && rec.recommendations.length > 0 && (
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Recommendations</Text>
                  {rec.recommendations.map((recommendation, rIdx) => {
                    const recText = typeof recommendation === 'object' ? String(recommendation.recommendation || '') : String(recommendation);
                    const recDate = typeof recommendation === 'object' && recommendation.date ? String(recommendation.date) : null;
                    return (
                      <Text key={rIdx} style={styles.listItem}>
                        {rIdx + 1}. {recText}{recDate ? ` (${recDate})` : ''}
                      </Text>
                    );
                  })}
                  <View style={styles.emptyLine} />
                </View>
              )}

              {/* Results */}
              {rec.results && Object.keys(rec.results).length > 0 && (
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Results</Text>
                  {Object.entries(rec.results).map(([key, value], idx) => (
                    <Text key={idx} style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>{String(key)}: </Text>
                      {String(value)}
                    </Text>
                  ))}
                  <View style={styles.emptyLine} />
                </View>
              )}

              {/* Notes */}
              {rec.notes && (
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Notes</Text>
                  <Text style={styles.textBlock}>{String(rec.notes)}</Text>
                </View>
              )}

              {/* Separator between records */}
              {recIdx < validRecords.length - 1 && <View style={styles.separator} />}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default NutritionAssessmentsDocumentPDFTemplate;
