module.exports = {
  title: '📊 Prognostic Factors',
  columns: ['Date', 'Factor', 'Value', 'Impact', 'Oncologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Factor: getValue(entry.factor || entry.prognosticFactor),
      Value: getValue(entry.value || entry.result),
      Impact: getValue(entry.impact || entry.significance),
      Oncologist: getValue(entry.oncologist || entry.provider)
    }));
  }
};
