module.exports = {
  title: '🔬 Flow Cytometry Reports',
  columns: ['Date', 'Specimen', 'Findings', 'Diagnosis', 'Pathologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Specimen: getValue(entry.specimen || entry.specimenType),
      Findings: getValue(entry.findings || entry.results),
      Diagnosis: getValue(entry.diagnosis || entry.interpretation),
      Pathologist: getValue(entry.pathologist || entry.provider)
    }));
  }
};
