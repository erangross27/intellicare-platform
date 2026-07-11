module.exports = {
  title: '🧠 Deep Brain Stimulation',
  columns: ['Date', 'Target', 'Settings', 'Response', 'Neurologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Target: getValue(entry.target || entry.location),
      Settings: getValue(entry.settings || entry.parameters),
      Response: getValue(entry.response || entry.outcome),
      Neurologist: getValue(entry.neurologist || entry.provider)
    }));
  }
};
