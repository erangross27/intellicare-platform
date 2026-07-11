module.exports = {
  title: '💉 Insulin Drip',
  columns: ['Date/Time', 'Blood Glucose', 'Insulin Rate', 'Rate Change', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      'Blood Glucose': getValue(entry.bloodGlucose || entry.bg),
      'Insulin Rate': getValue(entry.insulinRate || entry.rate),
      'Rate Change': getValue(entry.rateChange || entry.adjustment),
      Provider: getValue(entry.provider)
    }));
  }
};
