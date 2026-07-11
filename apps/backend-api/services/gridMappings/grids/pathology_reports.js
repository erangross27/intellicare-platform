module.exports = {
  title: '🔬 Pathology Reports',
  columns: ['Date', 'Specimen', 'Diagnosis', 'Grade', 'Pathologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : (entry.specimenDate ? new Date(entry.specimenDate).toLocaleDateString() : '-'),
      Specimen: getValue(entry.specimen || entry.specimenType || entry.tissue),
      Diagnosis: getValue(entry.diagnosis || entry.findings || entry.result),
      Grade: getValue(entry.grade || entry.stage),
      Pathologist: getValue(entry.pathologist || entry.provider)
    }));
  }
};
