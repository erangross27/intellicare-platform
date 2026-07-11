module.exports = {
  title: '🫘 Renal Biopsy',
  columns: ['Date', 'Indication', 'Findings', 'Diagnosis', 'Nephrologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Indication: getValue(entry.indication || entry.reason),
      Findings: getValue(entry.findings || entry.pathology),
      Diagnosis: getValue(entry.diagnosis || entry.interpretation),
      Nephrologist: getValue(entry.nephrologist || entry.provider)
    }));
  }
};
