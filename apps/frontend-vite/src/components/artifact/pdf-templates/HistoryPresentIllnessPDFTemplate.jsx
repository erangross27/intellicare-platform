import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * HistoryPresentIllnessPDFTemplate - December 2025
 * Updated to use new medical-specific schema fields
 * Helvetica 14pt, Natural page breaks, Block layout
 */

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontSize: 14,
        fontFamily: 'Helvetica',
        color: '#000000',
        backgroundColor: '#ffffff'
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
        fontFamily: 'Helvetica-Bold',
        textTransform: 'uppercase'
    },
    recordContainer: {
        marginBottom: 24
    },
    separator: {
        marginTop: 20,
        marginBottom: 20,
        borderBottom: '2 solid #000000'
    },
    recordHeader: {
        marginBottom: 16,
        paddingBottom: 8,
        borderBottom: '1 solid #cccccc'
    },
    recordDate: {
        fontSize: 12,
        color: '#666666',
        marginBottom: 4
    },
    recordTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        fontFamily: 'Helvetica-Bold',
        color: '#000000'
    },
    section: {
        marginBottom: 16
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#000000',
        marginBottom: 8,
        fontFamily: 'Helvetica-Bold',
        textTransform: 'uppercase',
        paddingBottom: 4,
        borderBottom: '1 solid #eeeeee'
    },
    subsectionTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#333333',
        marginBottom: 4,
        marginTop: 8,
        fontFamily: 'Helvetica-Bold'
    },
    fieldBlock: {
        marginBottom: 8
    },
    fieldLabel: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#444444',
        marginBottom: 2,
        fontFamily: 'Helvetica-Bold'
    },
    fieldValue: {
        fontSize: 12,
        color: '#000000',
        fontFamily: 'Helvetica',
        lineHeight: 1.5
    },
    paragraph: {
        fontSize: 12,
        color: '#000000',
        lineHeight: 1.6,
        marginBottom: 6,
        fontFamily: 'Helvetica'
    },
    listItem: {
        fontSize: 12,
        color: '#000000',
        marginBottom: 4,
        fontFamily: 'Helvetica',
        paddingLeft: 8
    },
    bulletItem: {
        fontSize: 12,
        color: '#000000',
        marginBottom: 4,
        fontFamily: 'Helvetica'
    },
    painScoreHigh: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#3d3d3d',
        fontFamily: 'Helvetica-Bold'
    },
    painScoreMod: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#797979',
        fontFamily: 'Helvetica-Bold'
    },
    painScoreLow: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#3c3c3c',
        fontFamily: 'Helvetica-Bold'
    },
    chiefComplaintBox: {
        backgroundColor: '#f0f0f0',
        padding: 10,
        marginBottom: 12,
        borderLeft: '4 solid #333333'
    },
    chiefComplaintText: {
        fontSize: 13,
        color: '#000000',
        fontFamily: 'Helvetica',
        lineHeight: 1.6
    },
    emptyState: {
        textAlign: 'center',
        color: '#666666',
        marginTop: 100
    }
});

// Helper to format date
const formatDate = (date) => {
    if (!date) return '';
    try {
        return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
        return String(date);
    }
};

// Helper to format duration
const formatDuration = (days) => {
    if (!days || days === 0) return '';
    if (days === 1) return '1 day';
    if (days < 7) return `${days} days`;
    if (days < 30) {
        const weeks = Math.floor(days / 7);
        const remainingDays = days % 7;
        if (remainingDays === 0) return weeks === 1 ? '1 week' : `${weeks} weeks`;
        return `${weeks} week${weeks > 1 ? 's' : ''}, ${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
    }
    if (days < 365) {
        const months = Math.floor(days / 30);
        return months === 1 ? '1 month' : `${months} months`;
    }
    const years = Math.floor(days / 365);
    return years === 1 ? '1 year' : `${years} years`;
};

// Helper: Check if value exists and is not empty
const hasValue = (val) => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'string') return val.trim() !== '';
    if (Array.isArray(val)) return val.length > 0 && val.some(v => v && String(v).trim() !== '');
    if (typeof val === 'number') return true;
    return true;
};

// Helper to split paragraphs into sentences
const splitIntoSentences = (text) => {
    if (!text || typeof text !== 'string') return [];
    return text
        .split(/(?<![Mm]r|[Mm]rs|[Mm]s|[Dd]r|[Pp]rof|[Ss]r|[Jj]r|vs|[Ee]tc|[Ii]nc|[Ll]td|[Cc]o)\.\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .map((s, idx, arr) => idx < arr.length - 1 ? s + '.' : s);
};

// Get pain score style based on severity
const getPainScoreStyle = (score) => {
    if (!score) return styles.fieldValue;
    if (score >= 7) return styles.painScoreHigh;
    if (score >= 4) return styles.painScoreMod;
    return styles.painScoreLow;
};

// Get pain interpretation
const getPainInterpretation = (score) => {
    if (!score) return '';
    if (score >= 7) return ' (Severe)';
    if (score >= 4) return ' (Moderate)';
    return ' (Mild)';
};

const HistoryPresentIllnessPDFTemplate = ({ document }) => {
    // Data unwrapping - handle wrapped collections
    let records = [];

    if (Array.isArray(document)) {
        records = document;
    } else if (document?.history_present_illness) {
        records = Array.isArray(document.history_present_illness)
            ? document.history_present_illness
            : [document.history_present_illness];
    } else if (document && typeof document === 'object') {
        records = [document];
    }

    // Filter valid records - check for new medical fields
    const validRecords = records.filter(record =>
        record.chiefComplaint || record.symptomOnsetDateTime || record.painSeverityScore ||
        record.symptomProgression || record.associatedSymptoms?.length > 0 ||
        record.functionalImpairmentLevel || record.previousEpisodeHistory
    );

    if (validRecords.length === 0) {
        return (
            <Document>
                <Page size="A4" style={styles.page}>
                    <Text style={styles.title}>History of Present Illness</Text>
                    <Text style={styles.emptyState}>No history of present illness records found.</Text>
                </Page>
            </Document>
        );
    }

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <Text style={styles.title}>History of Present Illness</Text>

                {validRecords.map((record, idx) => (
                    <View key={idx} style={styles.recordContainer} wrap={false}>
                        {idx > 0 && <View style={styles.separator} />}

                        {/* Record Header */}
                        <View style={styles.recordHeader}>
                            {hasValue(record.symptomOnsetDateTime) && (
                                <Text style={styles.recordDate}>Onset: {formatDate(record.symptomOnsetDateTime)}</Text>
                            )}
                            {hasValue(record.chiefComplaint) && (
                                <Text style={styles.recordTitle}>
                                    {record.chiefComplaint.length > 80
                                        ? record.chiefComplaint.substring(0, 80) + '...'
                                        : record.chiefComplaint}
                                </Text>
                            )}
                        </View>

                        {/* Chief Complaint Section */}
                        {hasValue(record.chiefComplaint) && (
                            <View style={styles.section} wrap={false}>
                                <Text style={styles.sectionTitle}>Chief Complaint</Text>
                                <View style={styles.chiefComplaintBox}>
                                    <Text style={styles.chiefComplaintText}>{record.chiefComplaint}</Text>
                                </View>
                            </View>
                        )}

                        {/* Symptom Timeline Section */}
                        {(hasValue(record.symptomOnsetDateTime) || hasValue(record.symptomDurationDays) ||
                            hasValue(record.triggeringEvent) || hasValue(record.symptomProgression)) && (
                            <View style={styles.section} wrap={false}>
                                <Text style={styles.sectionTitle}>Symptom Timeline</Text>

                                {hasValue(record.symptomOnsetDateTime) && (
                                    <View style={styles.fieldBlock}>
                                        <Text style={styles.fieldLabel}>Onset</Text>
                                        <Text style={styles.fieldValue}>{formatDate(record.symptomOnsetDateTime)}</Text>
                                    </View>
                                )}

                                {hasValue(record.symptomDurationDays) && (
                                    <View style={styles.fieldBlock}>
                                        <Text style={styles.fieldLabel}>Duration</Text>
                                        <Text style={styles.fieldValue}>{formatDuration(record.symptomDurationDays)}</Text>
                                    </View>
                                )}

                                {hasValue(record.triggeringEvent) && (
                                    <View style={styles.fieldBlock}>
                                        <Text style={styles.fieldLabel}>Triggering Event</Text>
                                        <Text style={styles.fieldValue}>{record.triggeringEvent}</Text>
                                    </View>
                                )}

                                {hasValue(record.symptomProgression) && (
                                    <View style={styles.fieldBlock}>
                                        <Text style={styles.fieldLabel}>Progression</Text>
                                        {splitIntoSentences(record.symptomProgression).map((sentence, sIdx) => (
                                            <Text key={sIdx} style={styles.paragraph}>{sentence}</Text>
                                        ))}
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Pain Assessment Section */}
                        {(hasValue(record.painSeverityScore) || hasValue(record.painCharacteristics) ||
                            hasValue(record.painRadiationPattern) || hasValue(record.alleviatingFactors) ||
                            hasValue(record.aggravatingFactors)) && (
                            <View style={styles.section} wrap={false}>
                                <Text style={styles.sectionTitle}>Pain Assessment</Text>

                                {hasValue(record.painSeverityScore) && (
                                    <View style={styles.fieldBlock}>
                                        <Text style={styles.fieldLabel}>Severity Score</Text>
                                        <Text style={getPainScoreStyle(record.painSeverityScore)}>
                                            {record.painSeverityScore}/10{getPainInterpretation(record.painSeverityScore)}
                                        </Text>
                                    </View>
                                )}

                                {hasValue(record.painCharacteristics) && (
                                    <View style={styles.fieldBlock}>
                                        <Text style={styles.fieldLabel}>Pain Characteristics</Text>
                                        {record.painCharacteristics.map((char, cIdx) => (
                                            <Text key={cIdx} style={styles.bulletItem}>• {char}</Text>
                                        ))}
                                    </View>
                                )}

                                {hasValue(record.painRadiationPattern) && (
                                    <View style={styles.fieldBlock}>
                                        <Text style={styles.fieldLabel}>Radiation Pattern</Text>
                                        <Text style={styles.fieldValue}>{record.painRadiationPattern}</Text>
                                    </View>
                                )}

                                {hasValue(record.alleviatingFactors) && (
                                    <View style={styles.fieldBlock}>
                                        <Text style={styles.fieldLabel}>Alleviating Factors</Text>
                                        {record.alleviatingFactors.map((factor, fIdx) => (
                                            <Text key={fIdx} style={styles.bulletItem}>• {factor}</Text>
                                        ))}
                                    </View>
                                )}

                                {hasValue(record.aggravatingFactors) && (
                                    <View style={styles.fieldBlock}>
                                        <Text style={styles.fieldLabel}>Aggravating Factors</Text>
                                        {record.aggravatingFactors.map((factor, fIdx) => (
                                            <Text key={fIdx} style={styles.bulletItem}>• {factor}</Text>
                                        ))}
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Associated Symptoms Section */}
                        {hasValue(record.associatedSymptoms) && (
                            <View style={styles.section} wrap={false}>
                                <Text style={styles.sectionTitle}>Associated Symptoms</Text>
                                {record.associatedSymptoms.map((symptom, sIdx) => (
                                    <Text key={sIdx} style={styles.bulletItem}>• {symptom}</Text>
                                ))}
                            </View>
                        )}

                        {/* Systems Review Section */}
                        {(() => {
                            const systemsFields = [
                                { key: 'respiratorySymptoms', label: 'Respiratory' },
                                { key: 'gastrointestinalSymptoms', label: 'Gastrointestinal' },
                                { key: 'neurologicalSymptoms', label: 'Neurological' },
                                { key: 'constitutionalSymptoms', label: 'Constitutional' },
                                { key: 'cardiovascularSymptoms', label: 'Cardiovascular' }
                            ];

                            const activeFields = systemsFields.filter(f => hasValue(record[f.key]));
                            if (activeFields.length === 0) return null;

                            return (
                                <View style={styles.section} wrap={false}>
                                    <Text style={styles.sectionTitle}>Systems Review</Text>
                                    {activeFields.map((field, fIdx) => (
                                        <View key={fIdx} style={styles.fieldBlock}>
                                            <Text style={styles.subsectionTitle}>{field.label}</Text>
                                            {record[field.key].map((item, iIdx) => (
                                                <Text key={iIdx} style={styles.bulletItem}>• {item}</Text>
                                            ))}
                                        </View>
                                    ))}
                                </View>
                            );
                        })()}

                        {/* Functional Impact Section */}
                        {(hasValue(record.functionalImpairmentLevel) || hasValue(record.workActivityLimitations) ||
                            hasValue(record.sleepDisturbances) || hasValue(record.appetiteChanges)) && (
                            <View style={styles.section} wrap={false}>
                                <Text style={styles.sectionTitle}>Functional Impact</Text>

                                {hasValue(record.functionalImpairmentLevel) && (
                                    <View style={styles.fieldBlock}>
                                        <Text style={styles.fieldLabel}>Impairment Level</Text>
                                        {splitIntoSentences(record.functionalImpairmentLevel).map((sentence, sIdx) => (
                                            <Text key={sIdx} style={styles.paragraph}>{sentence}</Text>
                                        ))}
                                    </View>
                                )}

                                {hasValue(record.workActivityLimitations) && (
                                    <View style={styles.fieldBlock}>
                                        <Text style={styles.fieldLabel}>Work/Activity Limitations</Text>
                                        <Text style={styles.fieldValue}>{record.workActivityLimitations}</Text>
                                    </View>
                                )}

                                {hasValue(record.sleepDisturbances) && (
                                    <View style={styles.fieldBlock}>
                                        <Text style={styles.fieldLabel}>Sleep Disturbances</Text>
                                        <Text style={styles.fieldValue}>{record.sleepDisturbances}</Text>
                                    </View>
                                )}

                                {hasValue(record.appetiteChanges) && (
                                    <View style={styles.fieldBlock}>
                                        <Text style={styles.fieldLabel}>Appetite Changes</Text>
                                        <Text style={styles.fieldValue}>{record.appetiteChanges}</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* History & Context Section */}
                        {(hasValue(record.previousEpisodeHistory) || hasValue(record.recentHealthcareContacts) ||
                            hasValue(record.currentMedicationEffectiveness)) && (
                            <View style={styles.section} wrap={false}>
                                <Text style={styles.sectionTitle}>History &amp; Context</Text>

                                {hasValue(record.previousEpisodeHistory) && (
                                    <View style={styles.fieldBlock}>
                                        <Text style={styles.fieldLabel}>Previous Episode History</Text>
                                        {splitIntoSentences(record.previousEpisodeHistory).map((sentence, sIdx) => (
                                            <Text key={sIdx} style={styles.paragraph}>{sentence}</Text>
                                        ))}
                                    </View>
                                )}

                                {hasValue(record.recentHealthcareContacts) && (
                                    <View style={styles.fieldBlock}>
                                        <Text style={styles.fieldLabel}>Recent Healthcare Contacts</Text>
                                        {record.recentHealthcareContacts.map((contact, cIdx) => (
                                            <Text key={cIdx} style={styles.bulletItem}>• {contact}</Text>
                                        ))}
                                    </View>
                                )}

                                {hasValue(record.currentMedicationEffectiveness) && (
                                    <View style={styles.fieldBlock}>
                                        <Text style={styles.fieldLabel}>Current Medication Effectiveness</Text>
                                        <Text style={styles.fieldValue}>{record.currentMedicationEffectiveness}</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                ))}
            </Page>
        </Document>
    );
};

export default HistoryPresentIllnessPDFTemplate;
