module.exports = {
  title: '🦴 Mineral Bone Disease',
  columns: ['Date', 'Calcium', 'Phosphorus', 'PTH', 'Nephrologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Calcium: getValue(entry.calcium || entry.ca),
      Phosphorus: getValue(entry.phosphorus || entry.phos),
      PTH: getValue(entry.pth || entry.parathyroid),
      Nephrologist: getValue(entry.nephrologist || entry.provider)
    }));
  }
};
