module.exports = {
  title: '🧠 Neuroimaging',
  columns: ['Date', 'Study Type', 'Indication', 'Findings', 'Radiologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Study Type': getValue(entry.studyType || entry.modality),
      Indication: getValue(entry.indication || entry.reason),
      Findings: getValue(entry.findings || entry.results),
      Radiologist: getValue(entry.radiologist || entry.provider)
    }));
  }
};
