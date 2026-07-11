module.exports = {
  title: '🔬 Cytology Reports',
  columns: ['Date', 'Specimen Type', 'Findings', 'Diagnosis', 'Cytopathologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Specimen Type': getValue(entry.specimenType || entry.specimen),
      Findings: getValue(entry.findings || entry.cytologicFindings),
      Diagnosis: getValue(entry.diagnosis || entry.interpretation),
      Cytopathologist: getValue(entry.cytopathologist || entry.provider)
    }));
  }
};
