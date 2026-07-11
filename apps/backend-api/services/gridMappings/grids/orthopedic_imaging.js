module.exports = {
  title: '📸 Orthopedic Imaging',
  columns: ['Date', 'Imaging Type', 'Body Part', 'Findings', 'Radiologist'],
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
      'Body Part': getValue(entry.bodyPart || entry.location),
      Findings: getValue(entry.findings || entry.results),
      Radiologist: getValue(entry.radiologist || entry.provider)
    }));
  }
};
