module.exports = {
  title: '📈 Treatment Course',
  columns: ['Date', 'Treatment', 'Response', 'Changes', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Treatment: getValue(entry.treatment || entry.therapy),
      Response: getValue(entry.response || entry.outcome),
      Changes: getValue(entry.changes || entry.adjustments),
      Provider: getValue(entry.provider)
    }));
  }
};
