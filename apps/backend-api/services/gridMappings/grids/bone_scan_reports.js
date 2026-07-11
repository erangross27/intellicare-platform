module.exports = {
  title: '🦴 Bone Scan Reports',
  columns: ['Date', 'Indication', 'Findings', 'Interpretation', 'Radiologist'],
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
      Findings: getValue(entry.findings || entry.results),
      Interpretation: getValue(entry.interpretation || entry.impression),
      Radiologist: getValue(entry.radiologist || entry.provider)
    }));
  }
};
