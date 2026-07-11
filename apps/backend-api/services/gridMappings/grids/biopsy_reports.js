module.exports = {
  title: '🔬 Biopsy Reports',
  columns: ['Date', 'Site', 'Histology', 'Diagnosis', 'Pathologist'],
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
      Histology: getValue(entry.histology || entry.microscopic),
      Diagnosis: getValue(entry.diagnosis || entry.pathologicDiagnosis),
      Pathologist: getValue(entry.pathologist || entry.provider)
    }));
  }
};
