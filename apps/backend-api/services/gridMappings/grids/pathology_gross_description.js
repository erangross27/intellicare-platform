module.exports = {
  title: '🔬 Pathology Gross Description',
  columns: ['Date', 'Specimen', 'Description', 'Measurements', 'Pathologist'],
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
      Description: getValue(entry.description || entry.grossDescription),
      Measurements: getValue(entry.measurements || entry.dimensions),
      Pathologist: getValue(entry.pathologist || entry.provider)
    }));
  }
};
