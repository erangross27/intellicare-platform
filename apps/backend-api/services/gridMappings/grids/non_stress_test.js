module.exports = {
  title: '🤰 Non-Stress Test',
  columns: ['Date', 'Gestational Age', 'Result', 'Accelerations', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Gestational Age': getValue(entry.gestationalAge || entry.ga),
      Result: getValue(entry.result || entry.interpretation),
      Accelerations: getValue(entry.accelerations || entry.reactivity),
      Provider: getValue(entry.provider)
    }));
  }
};
