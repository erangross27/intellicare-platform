module.exports = {
  title: '👂 Audiometry Reports',
  columns: ['Date', 'Right Ear', 'Left Ear', 'Interpretation', 'Audiologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Right Ear': getValue(entry.rightEar || entry.ad),
      'Left Ear': getValue(entry.leftEar || entry.as),
      Interpretation: getValue(entry.interpretation || entry.findings),
      Audiologist: getValue(entry.audiologist || entry.provider)
    }));
  }
};
