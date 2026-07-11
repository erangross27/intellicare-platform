module.exports = {
  title: '🔬 Pathology Report',
  columns: ['Date', 'Specimen', 'Diagnosis', 'Staging', 'Pathologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Specimen: getValue(entry.specimen || entry.sample),
      Diagnosis: getValue(entry.diagnosis || entry.findings),
      Staging: getValue(entry.staging || entry.grade),
      Pathologist: getValue(entry.pathologist || entry.provider)
    }));
  }
};
