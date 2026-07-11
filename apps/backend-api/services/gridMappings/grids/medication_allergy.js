module.exports = {
  title: '⚠️ Medication Allergies',
  columns: ['Date', 'Medication', 'Reaction', 'Severity', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Medication: getValue(entry.medication || entry.allergen),
      Reaction: getValue(entry.reaction || entry.reactionType),
      Severity: getValue(entry.severity || entry.severityLevel),
      Provider: getValue(entry.provider)
    }));
  }
};
