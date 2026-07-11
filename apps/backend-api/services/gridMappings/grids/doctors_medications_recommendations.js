module.exports = {
  title: '💊 Doctor\'s Medication Recommendations',
  columns: ['Medication', 'Dosage', 'Frequency', 'Indication', 'Status', 'Prescribed By', 'Date', 'Safety Warnings'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    // Convert medical abbreviations to readable text
    const formatFrequency = (frequency) => {
      if (!frequency || frequency === '-') return '-';

      let formatted = String(frequency);

      // Common medical abbreviations
      formatted = formatted
        .replace(/\bq(\d+)h\b/gi, 'Every $1 hours')           // q6h -> Every 6 hours
        .replace(/\bq(\d+)d\b/gi, 'Every $1 days')            // q2d -> Every 2 days
        .replace(/\bq(\d+)weeks?\b/gi, 'Every $1 weeks')      // q2weeks -> Every 2 weeks
        .replace(/\bq(\d+)months?\b/gi, 'Every $1 months')    // q2months -> Every 2 months
        .replace(/\bqd\b/gi, 'Daily')                         // qd -> Daily
        .replace(/\bbid\b/gi, 'Twice daily')                  // bid -> Twice daily
        .replace(/\btid\b/gi, 'Three times daily')            // tid -> Three times daily
        .replace(/\bqid\b/gi, 'Four times daily')             // qid -> Four times daily
        .replace(/\bprn\b/gi, 'As needed')                    // prn -> As needed
        .replace(/\bqhs\b/gi, 'At bedtime')                   // qhs -> At bedtime
        .replace(/\bqam\b/gi, 'Every morning')                // qam -> Every morning
        .replace(/\bqpm\b/gi, 'Every evening');               // qpm -> Every evening

      return formatted;
    };

    const formatStatus = (status) => {
      if (!status || status === '-') return '-';

      // Convert underscores/hyphens to spaces and title case each word
      const formatted = String(status)
        .toLowerCase()
        .replace(/[_-]/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      return formatted;
    };

    // Format safety warnings from stored safety check results
    const formatSafetyWarnings = (safetyCheck) => {
      if (!safetyCheck) return '✅ No safety concerns';

      const messages = [];

      // Add critical errors first
      if (safetyCheck.errors && safetyCheck.errors.length > 0) {
        safetyCheck.errors.forEach(err => {
          if (err.type === 'DIRECT_ALLERGY') {
            messages.push(`⛔ DIRECT ALLERGY - DO NOT ADMINISTER`);
          } else if (err.type === 'MAJOR_DRUG_INTERACTION') {
            const otherDrug = err.message.match(/with ([^:]+):/)?.[1] || 'other medication';
            messages.push(`⛔ Major interaction with ${otherDrug}`);
          } else if (err.type === 'HIGH_CROSS_SENSITIVITY') {
            messages.push(`⛔ High allergy cross-sensitivity risk`);
          }
        });
      }

      // Add warnings
      if (safetyCheck.warnings && safetyCheck.warnings.length > 0) {
        safetyCheck.warnings.forEach(warn => {
          if (warn.type === 'MODERATE_DRUG_INTERACTION') {
            const otherDrug = warn.message.match(/with ([^:]+):/)?.[1] || 'other medication';
            messages.push(`⚠️ Moderate interaction with ${otherDrug}`);
          } else if (warn.type === 'MODERATE_CROSS_SENSITIVITY') {
            messages.push(`⚠️ Moderate allergy cross-sensitivity`);
          }
        });
      }

      return messages.length > 0 ? messages.join('\n') : '✅ No safety concerns';
    };

    const results = [];

    for (const entry of categoryData) {
      const medicationName = getValue(entry.name);

      // Use safety warnings from the stored safety check (already performed during document save)
      const safetyWarning = formatSafetyWarnings(entry.safetyCheck);

      results.push({
        'Medication': medicationName,
        'Dosage': getValue(entry.dosage),
        'Frequency': formatFrequency(getValue(entry.frequency)),
        'Indication': getValue(entry.indication),
        'Status': formatStatus(entry.status || 'recommended'),
        'Prescribed By': getValue(entry.prescriber),
        'Date': entry.recommendationDate ? new Date(entry.recommendationDate).toLocaleDateString() : getValue(entry.date ? new Date(entry.date).toLocaleDateString() : '-'),
        'Safety Warnings': safetyWarning
      });
    }

    return results;
  }
};
