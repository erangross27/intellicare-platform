module.exports = {
  title: '⚠️ Risk Counseling',
  columns: ['Date', 'Risk Type', 'Discussion', 'Patient Understanding', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Risk Type': getValue(entry.riskType || entry.risk),
      Discussion: getValue(entry.discussion || entry.counseling),
      'Patient Understanding': getValue(entry.patientUnderstanding || entry.comprehension),
      Provider: getValue(entry.provider)
    }));
  }
};
