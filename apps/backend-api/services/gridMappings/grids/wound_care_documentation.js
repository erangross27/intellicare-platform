module.exports = {
  title: '🩹 Wound Care Documentation',
  columns: ['Date', 'Location', 'Size', 'Treatment', 'Nurse'],
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
      Size: getValue(entry.size || entry.dimensions),
      Treatment: getValue(entry.treatment || entry.interventions),
      Nurse: getValue(entry.nurse || entry.provider)
    }));
  }
};
