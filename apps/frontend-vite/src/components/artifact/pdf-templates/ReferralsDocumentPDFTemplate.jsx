import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * ReferralsDocumentPDFTemplate
 *
 * Flat list of referrals, each titled "Medical Referrals N".
 * Reason + Notes split (paren-aware + title-protected, ". " and "; ") into numbered items.
 * Helvetica, readable font sizes, fieldBox + conditional wrap for anti-orphan/anti-overprint.
 */

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 13,
    lineHeight: 1.5,
    color: '#000000',
    backgroundColor: '#FFFFFF'
  },
  title: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 16,
    textAlign: 'center',
    paddingBottom: 8,
    borderBottom: '1 solid #000000'
  },
  fieldBox: {
    marginBottom: 16,
    paddingBottom: 4
  },
  referralHeader: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6
  },
  subtitleLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 2,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  fieldValue: {
    fontSize: 13,
    fontFamily: 'Helvetica',
    color: '#000000',
    lineHeight: 1.4,
    marginBottom: 2
  },
  listItem: {
    fontSize: 13,
    fontFamily: 'Helvetica',
    color: '#000000',
    lineHeight: 1.4,
    marginBottom: 2,
    marginLeft: 10
  },
  pageNumber: {
    position: 'absolute',
    bottom: 20,
    right: 40,
    fontSize: 9,
    color: '#666666'
  }
});

const formatDate = (date) => {
  if (!date) return '';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(date);
  }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (Array.isArray(val)) return val.join(', ');
  return String(val);
};

// Split narrative text on ". " and "; " — parenthesis-aware + title-protected (matches the JSX).
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
  const trimmed = current.replace(/[.;]+$/, '').trim();
  if (trimmed) result.push(trimmed);
  return result;
};

const renderSplitField = (label, value) => {
  const text = safeString(value);
  if (!text) return null;
  const items = splitBySentence(text);
  return (
    <View>
      <Text style={styles.subtitleLabel}>{label}</Text>
      {items.length > 1
        ? items.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {item}</Text>)
        : <Text style={styles.fieldValue}>{text}</Text>}
    </View>
  );
};

const renderSimpleField = (label, value) => {
  const text = safeString(value);
  if (!text) return null;
  return (
    <View>
      <Text style={styles.subtitleLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{text}</Text>
    </View>
  );
};

const ReferralsDocumentPDFTemplate = ({ document: doc }) => {
  const data = doc || {};
  const referrals = Array.isArray(data.referrals) ? data.referrals : [];

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Medical Referrals</Text>

        {referrals.map((ref, idx) => {
          const n = (ref._origIdx != null ? ref._origIdx : idx) + 1;
          const reasonItems = splitBySentence(safeString(ref.reason));
          const notesItems = splitBySentence(safeString(ref.notes));
          // Anti-orphan/anti-overprint: keep a small referral together; let a long one flow.
          const rowCount = 1 + reasonItems.length + notesItems.length + 5;
          return (
            <View key={idx} style={styles.fieldBox} wrap={rowCount > 14 ? undefined : false}>
              <Text style={styles.referralHeader}>Medical Referrals {n}</Text>
              {renderSimpleField('Specialty', ref.specialty)}
              {ref.date ? renderSimpleField('Date', formatDate(ref.date)) : null}
              {renderSplitField('Reason', ref.reason)}
              {renderSimpleField('Urgency', ref.urgency)}
              {renderSimpleField('Status', ref.status)}
              {renderSimpleField('Provider', ref.provider)}
              {renderSimpleField('Referring Provider', ref.referringProvider)}
              {renderSplitField('Notes', ref.notes)}
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

export default ReferralsDocumentPDFTemplate;
