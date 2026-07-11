module.exports = {
  title: '🩹 Wound Care Instructions',
  columns: ['Date', 'Instructions', 'Frequency', 'Products', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Instructions: getValue(entry.instructions || entry.care),
      Frequency: getValue(entry.frequency || entry.schedule),
      Products: getValue(entry.products || entry.supplies),
      Provider: getValue(entry.provider)
    }));
  }
};
