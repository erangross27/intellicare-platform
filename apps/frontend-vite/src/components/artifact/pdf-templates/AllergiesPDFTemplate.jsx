import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * AllergiesPDFTemplate - December 2025 Black/White PDF Template
 *
 * Standards:
 * - Helvetica font (built-in, no registration needed)
 * - 14pt minimum for body text
 * - Black text on white background
 * - wrap={false} on sections based on size
 * - Component signature: { document, data }
 * - Notes split into sentences with "Note:" handling
 */

// Safe string helper for Unicode sanitization
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);

  // Replace problematic Unicode for Helvetica
  str = str.replace(/μm/g, 'um');
  str = str.replace(/µm/g, 'um');
  str = str.replace(/°/g, ' deg');
  str = str.replace(/±/g, '+/-');
  str = str.replace(/≥/g, '>=');
  str = str.replace(/≤/g, '<=');
  str = str.replace(/→/g, '->');
  str = str.replace(/"/g, '"');
  str = str.replace(/"/g, '"');
  str = str.replace(/'/g, "'");
  str = str.replace(/'/g, "'");
  str = str.replace(/—/g, '-');
  str = str.replace(/–/g, '-');

  return str;
};

/* ── Notes segmentation (mirrors AllergiesDocument.jsx) ──
   Split the Notes value into rows: sentences on '. ' (paren-aware + title-aware), then each
   sentence on ';' at paren depth 0. A leading "Label:" that introduces a >=2 item ';'-list
   (e.g. "Additional allergies: a; b; c") becomes a sub-header with each item on its own line.
   Returns an ordered array of { label: string|null, text: string }. */
const splitNotesSentences = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === '.' && depth === 0 && i + 1 < text.length && /\s/.test(text[i + 1])) {
      // Title / abbreviation protection (don't split after Dr., No., etc.)
      if (/(?:^|\s)(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|No|approx|Inc|Ltd|Co)$/i.test(current)) {
        current += ch;
        continue;
      }
      // Next non-space char must start a new sentence (uppercase letter or digit)
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (j < text.length && !/[A-Z0-9]/.test(text[j])) {
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
  const trimmed = current.trim();
  if (trimmed) result.push(trimmed);
  return result;
};

const splitNotesBySemicolon = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ';' && depth === 0) {
      const t = current.trim();
      if (t) result.push(t);
      current = '';
    } else {
      current += ch;
    }
  }
  const t = current.trim();
  if (t) result.push(t);
  return result;
};

const parseNotesLeadingLabel = (sentence) => {
  const m = sentence.match(/^([A-Z][A-Za-z][A-Za-z \-/]{0,38}[A-Za-z]):\s+(.+)$/);
  if (m) return { label: m[1].trim(), value: m[2].trim() };
  return { label: null, value: sentence };
};

const stripNotesTrailingPunct = (s) => String(s).replace(/[.;]+$/, '').trim();

const parseNotesSegments = (text) => {
  if (!text || typeof text !== 'string') return [];
  const segments = [];
  for (const sentence of splitNotesSentences(text)) {
    const { label, value } = parseNotesLeadingLabel(sentence);
    if (label) {
      const items = splitNotesBySemicolon(value);
      if (items.length >= 2) {
        // Labeled list (e.g. "Additional allergies: a; b; c") — grouped so the UI can box it together.
        items.forEach((item, i) => {
          segments.push({ label: i === 0 ? label : null, text: stripNotesTrailingPunct(item), grouped: true });
        });
        continue;
      }
    }
    const items = splitNotesBySemicolon(sentence);
    if (items.length >= 2) {
      items.forEach(item => segments.push({ label: null, text: stripNotesTrailingPunct(item), grouped: false }));
    } else {
      segments.push({ label: null, text: sentence.trim(), grouped: false });
    }
  }
  return segments;
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 14,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 20,
    color: '#000000',
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 10,
  },
  allergySection: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    paddingBottom: 12,
  },
  allergyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 6,
  },
  allergyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 12,
    color: '#666666',
  },
  severityBadge: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    width: 100,
  },
  fieldValue: {
    fontSize: 14,
    color: '#000000',
    flex: 1,
    lineHeight: 1.4,
  },
  notesContainer: {
    marginTop: 8,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 4,
  },
  noteSentence: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 3,
    paddingLeft: 12,
    lineHeight: 1.4,
  },
  noteSubtitle: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginTop: 6,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#666666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 40,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 10,
    color: '#666666',
    borderTopWidth: 1,
    borderTopColor: '#000000',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 10,
    color: '#666666',
  },
});

const AllergiesPDFTemplate = ({ document, data }) => {
  const templateData = document || data;

  // Unwrap data - handle multiple possible structures
  let allergies = [];
  if (Array.isArray(templateData)) {
    allergies = templateData;
  } else if (templateData?.allergies && Array.isArray(templateData.allergies)) {
    allergies = templateData.allergies;
  } else if (templateData?.allergen) {
    allergies = [templateData];
  }

  const formatDate = (dateString) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const renderAllergySection = (allergy, idx) => {
    const displayDate = formatDate(allergy.dateIdentified || allergy.createdAt);
    const notesSegments = allergy.notes ? parseNotesSegments(allergy.notes) : [];

    return (
      <View key={allergy._id || idx} style={styles.allergySection} wrap={false}>
        {/* Header: Allergy X | Date | Severity */}
        <View style={styles.allergyHeader}>
          <Text style={styles.allergyTitle}>Allergy {idx + 1}</Text>
          <View style={styles.headerRight}>
            {displayDate && <Text style={styles.dateText}>{displayDate}</Text>}
            {allergy.severity && (
              <Text style={styles.severityBadge}>[{safeString(allergy.severity)}]</Text>
            )}
          </View>
        </View>

        {/* Allergen */}
        {allergy.allergen && (
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Allergen:</Text>
            <Text style={styles.fieldValue}>{safeString(allergy.allergen)}</Text>
          </View>
        )}

        {/* Reaction */}
        {allergy.reaction && (
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Reaction:</Text>
            <Text style={styles.fieldValue}>{safeString(allergy.reaction)}</Text>
          </View>
        )}

        {/* Severity */}
        {allergy.severity && (
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Severity:</Text>
            <Text style={styles.fieldValue}>{safeString(allergy.severity)}</Text>
          </View>
        )}

        {/* Type */}
        {allergy.type && (
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Type:</Text>
            <Text style={styles.fieldValue}>{safeString(allergy.type)}</Text>
          </View>
        )}

        {/* Status */}
        {allergy.status && (
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Status:</Text>
            <Text style={styles.fieldValue}>{safeString(allergy.status)}</Text>
          </View>
        )}

        {/* Management */}
        {allergy.management && (
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Management:</Text>
            <Text style={styles.fieldValue}>{safeString(allergy.management)}</Text>
          </View>
        )}

        {/* Compliance */}
        {allergy.compliance && (
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Compliance:</Text>
            <Text style={styles.fieldValue}>{safeString(allergy.compliance)}</Text>
          </View>
        )}

        {/* Notes - split into rows by sentence + ';' separator (labels become sub-headers) */}
        {notesSegments.length > 0 && (
          <View style={styles.notesContainer}>
            <Text style={styles.notesLabel}>Notes:</Text>
            {notesSegments.map((seg, sIdx) => (
              <React.Fragment key={sIdx}>
                {seg.label && (
                  <Text style={styles.noteSubtitle}>{safeString(seg.label)}:</Text>
                )}
                <Text style={styles.noteSentence}>
                  {'\u2022'} {safeString(seg.text)}
                </Text>
              </React.Fragment>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>ALLERGIES</Text>

        {allergies.length === 0 ? (
          <Text style={styles.emptyText}>No known allergies</Text>
        ) : (
          allergies.map((allergy, idx) => renderAllergySection(allergy, idx))
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Protected Health Information (PHI) - Handle according to HIPAA guidelines
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
};

export default AllergiesPDFTemplate;
