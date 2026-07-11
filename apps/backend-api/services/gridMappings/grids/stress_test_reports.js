module.exports = {
  title: '🏃 Stress Test Reports',
  columns: ['Date', 'Test Type', 'Duration', 'Results', 'Cardiologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Test Type': getValue(entry.testType || entry.type),
      Duration: getValue(entry.duration || entry.exerciseTime),
      Results: getValue(entry.results || entry.findings),
      Cardiologist: getValue(entry.cardiologist || entry.provider)
    }));
  }
};
