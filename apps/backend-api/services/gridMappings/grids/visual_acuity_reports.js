module.exports = {
  title: '👓 Visual Acuity Reports',
  columns: ['Date', 'Right Eye', 'Left Eye', 'Corrected', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Right Eye': getValue(entry.rightEye || entry.od),
      'Left Eye': getValue(entry.leftEye || entry.os),
      Corrected: getValue(entry.corrected || entry.correctedAcuity),
      Provider: getValue(entry.provider)
    }));
  }
};
