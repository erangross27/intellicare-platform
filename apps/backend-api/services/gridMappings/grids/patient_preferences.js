module.exports = {
  title: '⚙️ Patient Preferences',
  columns: ['Date', 'Category', 'Preference', 'Notes', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Category: getValue(entry.category || entry.type),
      Preference: getValue(entry.preference || entry.choice),
      Notes: getValue(entry.notes || entry.details),
      Provider: getValue(entry.provider)
    }));
  }
};
