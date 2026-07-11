module.exports = {
  title: '🫁 Pulmonary Imaging',
  columns: ['Date', 'Imaging Type', 'Findings', 'Interpretation', 'Radiologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Imaging Type': getValue(entry.imagingType || entry.modality),
      Findings: getValue(entry.findings || entry.results),
      Interpretation: getValue(entry.interpretation || entry.impression),
      Radiologist: getValue(entry.radiologist || entry.provider)
    }));
  }
};
