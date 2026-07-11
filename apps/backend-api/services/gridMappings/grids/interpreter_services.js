module.exports = {
  title: '🗣️ Interpreter Services',
  columns: ['Date', 'Language', 'Service Type', 'Duration', 'Interpreter'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Language: getValue(entry.language || entry.languageNeeded),
      'Service Type': getValue(entry.serviceType || entry.type),
      Duration: getValue(entry.duration || entry.minutes),
      Interpreter: getValue(entry.interpreter || entry.provider)
    }));
  }
};
