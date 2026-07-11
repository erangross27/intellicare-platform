module.exports = {
  title: '🔬 Pathology Consult',
  columns: ['Date', 'Specimen', 'Diagnosis', 'Grade/Stage', 'Pathologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Specimen: getValue(entry.specimen || entry.tissue),
      Diagnosis: getValue(entry.diagnosis || entry.findings),
      'Grade/Stage': getValue(entry.gradeStage || entry.grade),
      Pathologist: getValue(entry.pathologist || entry.provider)
    }));
  }
};
