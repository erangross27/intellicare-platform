module.exports = {
  title: '🤕 Injury Details',
  columns: ['Date', 'Injury Type', 'Location', 'Mechanism', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Injury Type': getValue(entry.injuryType || entry.type),
      Location: getValue(entry.location || entry.site),
      Mechanism: getValue(entry.mechanism || entry.howOccurred),
      Provider: getValue(entry.provider)
    }));
  }
};
