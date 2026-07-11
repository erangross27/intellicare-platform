module.exports = {
  title: '🛏️ Patient Positioning',
  columns: ['Date', 'Position', 'Procedure', 'Padding/Support', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Position: getValue(entry.position || entry.patientPosition),
      Procedure: getValue(entry.procedure || entry.operation),
      'Padding/Support': getValue(entry.paddingSupport || entry.support),
      Provider: getValue(entry.provider)
    }));
  }
};
