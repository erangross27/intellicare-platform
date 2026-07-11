module.exports = {
  title: '📊 Vital Signs Monitoring',
  columns: ['Date', 'Vital Sign', 'Value', 'Frequency', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Vital Sign': getValue(entry.vitalSign || entry.parameter),
      Value: getValue(entry.value || entry.measurement),
      Frequency: getValue(entry.frequency || entry.schedule),
      Provider: getValue(entry.provider)
    }));
  }
};
