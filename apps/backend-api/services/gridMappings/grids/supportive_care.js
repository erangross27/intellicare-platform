module.exports = {
  title: '🤝 Supportive Care',
  columns: ['Date', 'Services', 'Symptoms Addressed', 'Response', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Services: getValue(entry.services || entry.interventions),
      'Symptoms Addressed': getValue(entry.symptomsAddressed || entry.symptoms),
      Response: getValue(entry.response || entry.outcome),
      Provider: getValue(entry.provider)
    }));
  }
};
