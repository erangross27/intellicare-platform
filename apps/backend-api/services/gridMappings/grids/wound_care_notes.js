module.exports = {
  title: '🩹 Wound Care Notes',
  columns: ['Date', 'Location', 'Progress', 'Treatment', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Location: getValue(entry.location || entry.site),
      Progress: getValue(entry.progress || entry.healing),
      Treatment: getValue(entry.treatment || entry.interventions),
      Provider: getValue(entry.provider)
    }));
  }
};
