module.exports = {
  title: '🫁 Ventilator Settings',
  columns: ['Date', 'Mode', 'Parameters', 'ABG Results', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Mode: getValue(entry.mode || entry.ventMode),
      Parameters: getValue(entry.parameters || entry.settings),
      'ABG Results': getValue(entry.abgResults || entry.bloodGas),
      Provider: getValue(entry.provider)
    }));
  }
};
