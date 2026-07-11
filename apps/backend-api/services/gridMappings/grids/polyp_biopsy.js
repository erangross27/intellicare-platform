module.exports = {
  title: '🔬 Polyp Biopsy',
  columns: ['Date', 'Location', 'Size', 'Pathology', 'Provider'],
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
      Pathology: getValue(entry.pathology || entry.histology),
      Provider: getValue(entry.provider)
    }));
  }
};
