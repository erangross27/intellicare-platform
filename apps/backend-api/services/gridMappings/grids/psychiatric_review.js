module.exports = {
  title: '🧠 Psychiatric Review',
  columns: ['Date', 'Mental Status', 'Symptoms', 'Progress', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Mental Status': getValue(entry.mentalStatus || entry.mse),
      Symptoms: getValue(entry.symptoms || entry.presentation),
      Progress: getValue(entry.progress || entry.improvement),
      Provider: getValue(entry.provider)
    }));
  }
};
