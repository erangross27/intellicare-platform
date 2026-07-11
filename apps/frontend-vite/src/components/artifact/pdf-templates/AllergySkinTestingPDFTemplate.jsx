import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Box-free, B&W, larger fonts: no backgroundColor, no borders — only #000000 text on #ffffff page.
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 13,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentTitle: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#000000',
  },
  recordContainer: {
    marginBottom: 24,
    paddingBottom: 16,
  },
  recordTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
    color: '#000000',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    marginBottom: 6,
    paddingLeft: 8,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 13,
    color: '#000000',
    lineHeight: 1.5,
  },
  fieldBox: {
    marginBottom: 12,
  },
  listItem: {
    fontSize: 13,
    color: '#000000',
    paddingLeft: 12,
    marginBottom: 4,
    lineHeight: 1.5,
  },
  subsectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginTop: 6,
    marginBottom: 4,
    paddingLeft: 4,
  },
  noData: {
    fontSize: 13,
    color: '#000000',
    textAlign: 'center',
    marginTop: 40,
  },
});

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = dateStr.$date || dateStr;
    const date = new Date(d);
    if (isNaN(date.getTime())) return String(dateStr || '');
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateStr || '');
  }
};

// Split text into sentences (matching JSX pattern)
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = [];
  let current = '';
  let parenDepth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    if ((ch === '.' || ch === ';') && parenDepth === 0 && i + 1 < text.length && /\s/.test(text[i + 1])) {
      if (ch === '.' && /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|etc)$/.test(current)) {
        current += ch;
        continue;
      }
      const trimmed = current.trim();
      if (trimmed) result.push(trimmed);
      current = '';
      while (i + 1 < text.length && /\s/.test(text[i + 1])) i++;
    } else {
      current += ch;
    }
  }
  const last = current.trim();
  if (last) result.push(last);
  return result;
};

// Split by comma (parenthesis-aware)
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text];
  const result = [];
  let current = '';
  let parenDepth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    if (ch === ',' && parenDepth === 0) {
      const trimmed = current.trim();
      if (trimmed) result.push(trimmed);
      current = '';
    } else {
      current += ch;
    }
  }
  const last = current.trim();
  if (last) result.push(last);
  return result;
};

// Parse "Label: Value" pattern
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const match = text.match(/^([A-Z][A-Za-z0-9 &/()>=<+%.#-]+):\s*(.+)$/);
  if (match) return { isLabeled: true, label: match[1].trim(), value: match[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

// Render sentence field with numbering and comma-split
const renderSentenceField = (sectionTitle, text) => {
  if (!text) return null;
  const sentences = splitBySentence(String(text));
  if (sentences.length === 0) return null;

  let n = 1;
  const blocks = []; // { lead: string|null, rows: [{num, text}] }

  sentences.forEach((sentence) => {
    const parsed = parseLabel(sentence);
    const textToSplit = parsed.isLabeled ? parsed.value : sentence;
    let commaParts = parsed.isLabeled ? splitByComma(textToSplit) : [textToSplit];
    // Handle "count (item1, item2, ...)" pattern where commas are inside parens
    if (commaParts.length < 2 && parsed.isLabeled) {
      const parenListMatch = textToSplit.match(/^\d+\s*\((.+)\)$/);
      if (parenListMatch) {
        commaParts = parenListMatch[1].split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    const displayParts = commaParts.length >= 2 ? commaParts : [textToSplit];

    if (parsed.isLabeled && displayParts.length >= 2) {
      blocks.push({ lead: parsed.label, rows: displayParts.map(p => ({ num: n++, text: p })) });
    } else if (parsed.isLabeled) {
      blocks.push({ lead: parsed.label, rows: [{ num: n++, text: parsed.value }] });
    } else if (displayParts.length >= 2) {
      blocks.push({ lead: null, rows: displayParts.map(p => ({ num: n++, text: p })) });
    } else {
      blocks.push({ lead: null, rows: [{ num: n++, text: sentence }] });
    }
  });

  // Anti-orphan (memory 6a2a8e38 / 699004a9): glue the section title + each sub-label with its FIRST
  // row in a wrap={false} View so a heading never sits alone at a page bottom; remaining rows flow.
  return (
    <View style={styles.fieldBox}>
      {blocks.map((block, bi) => {
        const [firstRow, ...restRows] = block.rows;
        return (
          <React.Fragment key={bi}>
            <View wrap={false}>
              {bi === 0 && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
              {block.lead && <Text style={styles.subsectionTitle}>{block.lead}</Text>}
              {firstRow && <Text style={styles.listItem}>{firstRow.num}. {firstRow.text}</Text>}
            </View>
            {restRows.map((r, ri) => (
              <Text key={ri} style={styles.listItem}>{r.num}. {r.text}</Text>
            ))}
          </React.Fragment>
        );
      })}
    </View>
  );
};

// Convert a dynamic object key into a readable label (matches JSX humanizeKey)
const humanizeKey = (key) => {
  if (key === null || key === undefined) return '';
  return String(key)
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
};

// Flatten a scalar/array/object value into readable text (avoids [object Object])
const flattenValue = (v) => {
  if (Array.isArray(v)) return v.map(flattenValue).join(', ');
  if (v !== null && typeof v === 'object') {
    return Object.entries(v).map(([k, vv]) => `${humanizeKey(k)}: ${flattenValue(vv)}`).join('; ');
  }
  return String(v ?? '');
};

// Render a dynamic-key object field (e.g. whealSize). Anti-orphan (memory 6a2a8e38 / 699004a9):
// each label+value row is wrap={false} (its sub-label never splits from its value across a page),
// and the section title is glued to the first entry.
const renderObjectField = (sectionTitle, obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const entries = Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (entries.length === 0) return null;
  const renderRow = (k, v, key) => (
    <View key={key} style={styles.row} wrap={false}>
      <Text style={styles.label}>{humanizeKey(k)}</Text>
      <Text style={styles.value}>{flattenValue(v)}</Text>
    </View>
  );
  return (
    <View style={styles.fieldBox} wrap={entries.length > 8 ? true : false}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{sectionTitle}</Text>
        {renderRow(entries[0][0], entries[0][1], 'e0')}
      </View>
      {entries.slice(1).map(([k, v], i) => renderRow(k, v, i))}
    </View>
  );
};

// Render a simple numbered list section. Anti-orphan: glue the title + first item; remaining items flow.
const renderListSection = (sectionTitle, items) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <View style={styles.fieldBox} wrap={items.length > 8 ? true : false}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{sectionTitle}</Text>
        <Text style={styles.listItem}>1. {String(items[0])}</Text>
      </View>
      {items.slice(1).map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 2}. {String(item)}</Text>
      ))}
    </View>
  );
};

// Chart utilities
const categorizeAllergen = (allergen) => {
  const l = allergen.toLowerCase();
  if (l.includes('aspergillus') || l.includes('penicillium') || l.includes('cladosporium') || l.includes('alternaria') || l.includes('mold') || l.includes('fungi') || l.includes('fusarium') || l.includes('mucor')) return 'Molds/Fungi';
  if (l.includes('dust') || l.includes('mite') || l.includes('cockroach') || l.includes('indoor')) return 'Environmental';
  if (l.includes('cat') || l.includes('dog') || l.includes('horse') || l.includes('pet') || l.includes('animal') || l.includes('dander') || l.includes('feather')) return 'Animals';
  if (l.includes('grass') || l.includes('tree') || l.includes('weed') || l.includes('ragweed') || l.includes('pollen') || l.includes('birch') || l.includes('oak') || l.includes('cedar')) return 'Pollens';
  if (l.includes('peanut') || l.includes('milk') || l.includes('egg') || l.includes('wheat') || l.includes('soy') || l.includes('shellfish') || l.includes('fish') || l.includes('nut') || l.includes('food')) return 'Foods';
  return 'Other';
};

const extractClassData = (reactions) => {
  if (!reactions || !Array.isArray(reactions)) return [];
  return reactions.map(reaction => {
    const classMatch = String(reaction).match(/Class\s*(\d+)/i);
    const kuMatch = String(reaction).match(/([\d.]+)\s*kU\/L/i);
    const allergenMatch = String(reaction).match(/^([^(]+)/);
    const classLevel = classMatch ? parseInt(classMatch[1], 10) : null;
    const kuValue = kuMatch ? parseFloat(kuMatch[1]) : null;
    const allergen = allergenMatch ? allergenMatch[1].trim() : reaction;
    return { allergen, classLevel, kuValue, category: categorizeAllergen(allergen), rawText: reaction };
  }).filter(item => item.classLevel !== null);
};

const groupByCategory = (chartData) => {
  const groups = {};
  chartData.forEach(item => {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push(item);
  });
  const order = ['Molds/Fungi', 'Environmental', 'Pollens', 'Foods', 'Animals', 'Other'];
  return order.filter(cat => groups[cat]).map(cat => ({ category: cat, items: groups[cat] }));
};

const getClassInterpretation = (cl) => {
  if (cl === 0) return 'Negative';
  if (cl === 1) return 'Low';
  if (cl === 2) return 'Moderate';
  if (cl === 3) return 'High';
  if (cl >= 4) return 'Very High';
  return 'Unknown';
};

const AllergySkinTestingPDFTemplate = ({ document: documentProp }) => {
  let records = [];
  if (Array.isArray(documentProp)) {
    records = documentProp;
  } else if (documentProp?.allergy_skin_testing && Array.isArray(documentProp.allergy_skin_testing)) {
    records = documentProp.allergy_skin_testing;
  } else if (documentProp) {
    records = [documentProp];
  }

  const validRecords = records.filter(Boolean);

  if (!validRecords.length) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Allergy Skin Testing</Text>
          <Text style={styles.noData}>No allergy skin testing data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Allergy Skin Testing</Text>

        {validRecords.map((record, idx) => {
          const chartData = extractClassData(record.positiveReactions);
          const hasChartData = chartData.length > 0;
          const groupedData = hasChartData ? groupByCategory(chartData) : [];

          return (
            <View key={idx} style={styles.recordContainer}>
              <View wrap={false}>
                <Text style={styles.recordTitle}>
                  Allergy Skin Test {idx + 1}
                  {record.date ? ` — ${formatDate(record.date)}` : ''}
                </Text>
              </View>

              {/* Test Information */}
              {(record.testType || record.allergist || record.facility) && (
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>TEST INFORMATION</Text>
                  {record.testType && (
                    <View style={styles.row}>
                      <Text style={styles.label}>Test Type</Text>
                      <Text style={styles.value}>{String(record.testType)}</Text>
                    </View>
                  )}
                  {record.allergist && (
                    <View style={styles.row}>
                      <Text style={styles.label}>Allergist</Text>
                      <Text style={styles.value}>{String(record.allergist)}</Text>
                    </View>
                  )}
                  {record.facility && (
                    <View style={styles.row}>
                      <Text style={styles.label}>Facility</Text>
                      <Text style={styles.value}>{String(record.facility)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Controls (sentence field) */}
              {renderSentenceField('CONTROLS', record.controls)}

              {/* Wheal Size (dynamic-key object — keys vary per record) */}
              {renderObjectField('WHEAL SIZE', record.whealSize)}

              {/* Positive Reactions Chart — clean B&W text rows grouped by category */}
              {hasChartData && (
                <View style={styles.fieldBox} wrap={chartData.length > 8 ? true : false}>
                  {(() => {
                    let n = 0;
                    return groupedData.map((group, groupIdx) => (
                      <View key={groupIdx} wrap={false}>
                        {groupIdx === 0 && <Text style={styles.sectionTitle}>POSITIVE REACTIONS CHART</Text>}
                        <Text style={styles.subsectionTitle}>{group.category}</Text>
                        {group.items.map((item, itemIdx) => {
                          n += 1;
                          return (
                            <Text key={itemIdx} style={styles.listItem}>
                              {n}. {item.allergen} — Class {item.classLevel}{item.kuValue ? ` (${item.kuValue} kU/L)` : ''} — {getClassInterpretation(item.classLevel)}
                            </Text>
                          );
                        })}
                      </View>
                    ));
                  })()}
                </View>
              )}

              {/* Allergens Tested */}
              {renderListSection('ALLERGENS TESTED', record.allergensTested)}

              {/* Positive Reactions (list) */}
              {renderListSection('POSITIVE REACTIONS', record.positiveReactions)}

              {/* Negative Reactions */}
              {renderListSection('NEGATIVE REACTIONS', record.negativeReactions)}

              {/* Medications Withheld */}
              {renderListSection('MEDICATIONS WITHHELD', record.medicationWithheld)}

              {/* Adverse Reactions (simple) */}
              {record.adverseReactions && (
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>ADVERSE REACTIONS</Text>
                  <View style={styles.row}>
                    <Text style={styles.value}>{String(record.adverseReactions)}</Text>
                  </View>
                </View>
              )}

              {/* Interpretation (sentence field) */}
              {renderSentenceField('INTERPRETATION', record.interpretation)}

              {/* Recommendations (sentence field) */}
              {renderSentenceField('RECOMMENDATIONS', record.recommendations)}

              {/* Notes (sentence field) */}
              {renderSentenceField('NOTES', record.notes)}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default AllergySkinTestingPDFTemplate;
