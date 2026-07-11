module.exports = {
  title: '📋 Hypoglycemia Protocol',
  columns: ['Date', 'Threshold', 'Actions', 'Follow-up', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Threshold: getValue(entry.threshold || entry.glucoseThreshold),
      Actions: getValue(entry.actions || entry.protocol),
      'Follow-up': getValue(entry.followUp || entry.monitoring),
      Provider: getValue(entry.provider)
    }));
  }
};
