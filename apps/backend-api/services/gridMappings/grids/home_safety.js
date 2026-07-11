module.exports = {
  title: '🏠 Home Safety',
  columns: ['Date', 'Hazards Identified', 'Modifications', 'Status', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Hazards Identified': getValue(entry.hazardsIdentified || entry.hazards),
      Modifications: getValue(entry.modifications || entry.changes),
      Status: getValue(entry.status || entry.completion),
      Provider: getValue(entry.provider)
    }));
  }
};
