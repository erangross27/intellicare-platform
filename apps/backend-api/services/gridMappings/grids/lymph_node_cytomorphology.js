module.exports = {
  title: '🔬 Lymph Node Cytomorphology',
  columns: ['Date', 'Site', 'Findings', 'Diagnosis', 'Pathologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Site: getValue(entry.site || entry.location),
      Findings: getValue(entry.findings || entry.morphology),
      Diagnosis: getValue(entry.diagnosis || entry.interpretation),
      Pathologist: getValue(entry.pathologist || entry.provider)
    }));
  }
};
