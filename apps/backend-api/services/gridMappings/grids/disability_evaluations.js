module.exports = {
  title: '♿ Disability Evaluations',
  columns: ['Date', 'Condition', 'Functional Limitations', 'Recommendations', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Condition: getValue(entry.condition || entry.diagnosis),
      'Functional Limitations': getValue(entry.functionalLimitations || entry.limitations),
      Recommendations: getValue(entry.recommendations || entry.accommodations),
      Provider: getValue(entry.provider)
    }));
  }
};
