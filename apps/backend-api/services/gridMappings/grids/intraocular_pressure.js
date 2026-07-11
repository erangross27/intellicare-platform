module.exports = {
  title: '👁️ Intraocular Pressure',
  columns: ['Date', 'Right Eye', 'Left Eye', 'Method', 'Provider'],
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
      Method: getValue(entry.method || entry.technique),
      Provider: getValue(entry.provider)
    }));
  }
};
