import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const SECTIONS = [
  { title: 'Performance Status', fields: ['palliativeConsultDate', 'painScaleScore', 'edmontonSymptomAssessmentScore', 'karnofskyPerformanceStatus', 'ecogPerformanceStatus'] },
  { title: 'Symptom Management', fields: ['opioidMedicationName', 'morphineEquivalentDose', 'nauseaVomitingSeverity', 'dyspneaSeverity', 'constrainedBowelMovementDays', 'symptomManagementMedications'] },
  { title: 'Nutrition & Well-Being', fields: ['nutritionalSupportType', 'albuminLevel', 'prealbumin', 'weightLossPercentage', 'sleepDisturbanceScale', 'anxietyLevel', 'depressionScreeningScore'] },
  { title: 'Psychosocial Support', fields: ['socialWorkConsult', 'chaplainServices', 'familyMeetingDate'] },
  { title: 'Advance Care Planning', fields: ['advanceDirectiveStatus', 'codeStatus', 'hospiceReferralDate'] },
];

const LABELS = {
  palliativeConsultDate: 'Palliative Consult Date', painScaleScore: 'Pain Scale Score',
  edmontonSymptomAssessmentScore: 'Edmonton Symptom Assessment Score', karnofskyPerformanceStatus: 'Karnofsky Performance Status',
  ecogPerformanceStatus: 'ECOG Performance Status', opioidMedicationName: 'Opioid Medication Name',
  morphineEquivalentDose: 'Morphine Equivalent Dose', nauseaVomitingSeverity: 'Nausea/Vomiting Severity',
  dyspneaSeverity: 'Dyspnea Severity', constrainedBowelMovementDays: 'Constipation (Days Without BM)',
  symptomManagementMedications: 'Symptom Management Medications', nutritionalSupportType: 'Nutritional Support Type',
  albuminLevel: 'Albumin Level', prealbumin: 'Prealbumin', weightLossPercentage: 'Weight Loss Percentage',
  sleepDisturbanceScale: 'Sleep Disturbance Scale', anxietyLevel: 'Anxiety Level',
  depressionScreeningScore: 'Depression Screening Score', socialWorkConsult: 'Social Work Consult',
  chaplainServices: 'Chaplain Services', familyMeetingDate: 'Family Meeting Date',
  advanceDirectiveStatus: 'Advance Directive Status', codeStatus: 'Code Status', hospiceReferralDate: 'Hospice Referral Date',
};

const COMMA_ARRAY_FIELDS = ['symptomManagementMedications'];
const NUMBER_SUFFIXES = {
  painScaleScore: '/10', edmontonSymptomAssessmentScore: '/90',
  karnofskyPerformanceStatus: '/100', ecogPerformanceStatus: '/5',
  morphineEquivalentDose: ' mg/day', constrainedBowelMovementDays: ' days',
  albuminLevel: ' g/dL', prealbumin: ' mg/dL', weightLossPercentage: '%',
  sleepDisturbanceScale: '/10', depressionScreeningScore: '/27',
};
const fieldMatches = (fields, path) =>
  fields.some((field) => path === field || path.startsWith(`${field}.`));
const empty = (value) =>
  value == null ||
  value === "" ||
  (Array.isArray(value)
    ? !value.some((item) => !empty(item))
    : typeof value === "object" && !value.$date
      ? Object.values(value).every(empty)
      : false);
const isDate = (value) =>
  Boolean(
    value?.$date ||
    (typeof value === "string" && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)),
  );
const safe = (value) =>
  String(value ?? "")
    .replace(/[µμ]/g, "u")
    .replace(/°/g, " deg")
    .replace(/±/g, "+/-")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/→/g, "->")
    .replace(/–/g, "-");
const formatDate = (value) => {
  try {
    const date = new Date(value?.$date || value);
    return Number.isNaN(date.getTime())
      ? safe(value)
      : date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
  } catch {
    return safe(value);
  }
};
const humanize = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
const splitComma = (text) => {
  const rows = [];
  let current = "";
  let depth = 0;
  for (const char of String(text || "")) {
    if (char === "(") {
      depth += 1;
      current += char;
    } else if (char === ")") {
      depth = Math.max(0, depth - 1);
      current += char;
    } else if (char === "," && depth === 0) {
      if (current.trim()) rows.push(current.trim());
      current = "";
    } else current += char;
  }
  if (current.trim()) rows.push(current.trim());
  return rows.length ? rows : [String(text || "")];
};
const parseLabel = (text) => {
  const match = String(text || "").match(
    /^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/,
  );
  return match
    ? { label: match[1].trim(), value: match[2].trim() }
    : { label: "", value: String(text || "") };
};
const splitTokens = (text) => {
  const source = String(text || "");
  const regex =
    /(?:;\s+|(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)\.\s+)/g;
  const tokens = [];
  let start = 0;
  let match;
  while ((match = regex.exec(source))) {
    const value = source.slice(start, match.index).trim();
    if (value) tokens.push(value);
    start = match.index + match[0].length;
  }
  const tail = source
    .slice(start)
    .replace(/[.;]\s*$/, "")
    .trim();
  if (tail) tokens.push(tail);
  return tokens.length ? tokens : [source.trim()];
};
const scalarRows = (path, value) => {
  const display = isDate(value)
    ? formatDate(value)
    : typeof value === "boolean"
      ? value
        ? "Yes"
        : "No"
      : typeof value === "number" && NUMBER_SUFFIXES[path]
        ? `${safe(value)}${NUMBER_SUFFIXES[path]}`
        : safe(value);
  if (
    /^-?\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?|\s*-\s*\d+(?:\.\d+)?)?[\s\S]*$/.test(
      display,
    )
  ) {
    return [{ label: "", text: display }];
  }
  return splitTokens(display).flatMap((token) => {
    const parsed = parseLabel(token);
    const values = fieldMatches(COMMA_ARRAY_FIELDS, path)
      ? splitComma(parsed.value)
      : [parsed.value];
    return values.map((text, index) => ({
      label: index === 0 ? parsed.label : "",
      text,
    }));
  });
};
const unwrap = (input) => {
  if (!input) return [];
  return (Array.isArray(input) ? input : [input])
    .flatMap((item) => {
      if (item?.supportive_care)
        return Array.isArray(item.supportive_care)
          ? item.supportive_care
          : [item.supportive_care];
      if (item?.documentData?.supportive_care)
        return Array.isArray(item.documentData.supportive_care)
          ? item.documentData.supportive_care
          : [item.documentData.supportive_care];
      if (item?.documentData)
        return Array.isArray(item.documentData)
          ? item.documentData
          : [item.documentData];
      if (item?.document)
        return Array.isArray(item.document) ? item.document : [item.document];
      return [item];
    })
    .filter((record) => record && typeof record === "object");
};

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: "Helvetica",
    color: "#000000",
    fontSize: 14,
    backgroundColor: "#ffffff",
  },
  documentTitle: {
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 18,
    paddingBottom: 7,
    borderBottomWidth: 2,
    borderBottomColor: "#000000",
  },
  record: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: "Helvetica-Bold", marginBottom: 12 },
  section: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 7,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
  },
  fieldBlock: { marginLeft: 10, marginBottom: 7 },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
    paddingBottom: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: "#999999",
  },
  fieldValue: { fontSize: 14, lineHeight: 1.35, marginBottom: 2 },
});

const scalarBlocks = (path, value, label = "") =>
  scalarRows(path, value).map((row, index) => (
    <View key={`${path}-${index}`} style={styles.fieldBlock} wrap={false}>
      {index === 0 && label ? (
        <Text style={styles.fieldLabel}>{safe(label)}</Text>
      ) : null}
      {row.label ? (
        <Text style={styles.fieldLabel}>{safe(row.label)}</Text>
      ) : null}
      <Text style={styles.fieldValue}>{`${index + 1}. ${safe(row.text)}`}</Text>
    </View>
  ));

const nodeBlocks = (path, value, label = "") => {
  if (empty(value)) return [];
  if (isDate(value) || typeof value !== "object")
    return scalarBlocks(path, value, label);
  if (Array.isArray(value)) {
    const items = value
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !empty(item));
    if (items.every(({ item }) => isDate(item) || typeof item !== "object")) {
      return items.flatMap(({ item, index }) => {
        const rows = scalarRows(`${path}.${index}`, item);
        return rows.map((row, rowIndex) => (
          <View
            key={`${path}.${index}-${rowIndex}`}
            style={styles.fieldBlock}
            wrap={false}
          >
            {index === 0 && rowIndex === 0 && label ? (
              <Text style={styles.fieldLabel}>{safe(label)}</Text>
            ) : null}
            {row.label ? (
              <Text style={styles.fieldLabel}>{safe(row.label)}</Text>
            ) : null}
            <Text style={styles.fieldValue}>{`${index + 1}. ${safe(row.text)}`}</Text>
          </View>
        ));
      });
    }
    return items.flatMap(({ item, index }) => {
      const itemLabel =
        item?.substance || item?.type || `${label || "Item"} ${index + 1}`;
      const heading = (
        <View
          key={`${path}.${index}-heading`}
          style={styles.fieldBlock}
          wrap={false}
        >
          <Text style={styles.fieldLabel}>{safe(itemLabel)}</Text>
        </View>
      );
      return [
        heading,
        ...Object.entries(item)
          .filter(([, child]) => !empty(child))
          .flatMap(([key, child]) =>
            nodeBlocks(`${path}.${index}.${key}`, child, humanize(key)),
          ),
      ];
    });
  }
  return Object.entries(value)
    .filter(([, child]) => !empty(child))
    .flatMap(([key, child]) =>
      nodeBlocks(`${path}.${key}`, child, humanize(key)),
    );
};

const recommendationBlocks = (value) => {
  const groups = new Map();
  value.forEach((item, index) => {
    const date = item?.date || "";
    const key = date ? String(date?.$date || date).slice(0, 10) : "no-date";
    if (!groups.has(key)) groups.set(key, { date, items: [] });
    groups.get(key).items.push({ item, index });
  });
  return [...groups.entries()].flatMap(([key, group]) => {
    const blocks = [];
    if (key !== "no-date")
      blocks.push(
        <View key={`${key}-date`} style={styles.fieldBlock} wrap={false}>
          <Text style={styles.fieldLabel}>Date</Text>
          <Text style={styles.fieldValue}>{formatDate(group.date)}</Text>
        </View>,
      );
    let rowNumber = 1;
    group.items.forEach(({ item, index }) => {
      const text = typeof item === "object" ? item.recommendation : item;
      scalarRows(`recommendations.${index}.recommendation`, text).forEach(
        (row) => {
          blocks.push(
            <View
              key={`${key}-${index}-${rowNumber}`}
              style={styles.fieldBlock}
              wrap={false}
            >
              {row.label ? (
                <Text style={styles.fieldLabel}>{safe(row.label)}</Text>
              ) : null}
              <Text
                style={styles.fieldValue}
              >{`${rowNumber}. ${safe(row.text)}`}</Text>
            </View>,
          );
          rowNumber += 1;
        },
      );
    });
    return blocks;
  });
};

const sectionBlocks = (record, section) =>
  section.fields.flatMap((field) => {
    const value = record[field];
    if (empty(value)) return [];
    if (field === "recommendations" && Array.isArray(value))
      return recommendationBlocks(value);
    const label =
      (LABELS[field] || humanize(field)).toLowerCase() ===
      section.title.toLowerCase()
        ? ""
        : LABELS[field] || humanize(field);
    return nodeBlocks(field, value, label);
  });

const SupportiveCareDocumentPDFTemplate = ({
  document,
  data,
  templateData,
}) => {
  const records = unwrap(templateData || document || data);
  return (
    <Document>
      {records.length ? (
        records.map((record, recordIndex) => (
          <Page size="A4" style={styles.page} key={recordIndex}>
            <Text style={styles.documentTitle}>Supportive Care</Text>
            <View style={styles.record}>
              <Text
                style={styles.recordTitle}
              >{`Supportive Care ${recordIndex + 1}`}</Text>
              {SECTIONS.map((section) => {
                const blocks = sectionBlocks(record, section);
                if (!blocks.length) return null;
                return (
                  <View style={styles.section} key={section.title}>
                    <View wrap={false}>
                      <Text style={styles.sectionTitle}>{section.title}</Text>
                      {blocks[0]}
                    </View>
                    {blocks.slice(1)}
                  </View>
                );
              })}
            </View>
          </Page>
        ))
      ) : (
        <Page size="A4" style={styles.page}>
          <Text style={styles.documentTitle}>Supportive Care</Text>
          <Text style={styles.fieldValue}>No records available</Text>
        </Page>
      )}
    </Document>
  );
};

export default SupportiveCareDocumentPDFTemplate;
