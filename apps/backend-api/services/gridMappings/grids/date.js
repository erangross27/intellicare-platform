module.exports = {
  title: '📅 Date Records',
  columns: ['Date', 'Event Type', 'Description', 'Provider', 'Source'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Event Type': getValue(entry.eventType || entry.type),
      Description: getValue(entry.description || entry.notes),
      Provider: getValue(entry.provider),
      Source: getValue(entry.source || entry.documentType)
    }));
  }
};
