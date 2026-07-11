module.exports = {
  title: '🚨 Urgent Call Criteria',
  columns: ['Date', 'Criteria', 'Symptoms', 'Action', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Criteria: getValue(entry.criteria || entry.warningSign),
      Symptoms: getValue(entry.symptoms || entry.presentation),
      Action: getValue(entry.action || entry.recommendation),
      Provider: getValue(entry.provider)
    }));
  }
};
