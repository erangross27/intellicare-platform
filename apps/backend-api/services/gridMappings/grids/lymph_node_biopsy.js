module.exports = {
  title: '🔬 Lymph Node Biopsy',
  columns: ['Date', 'Location', 'Method', 'Pathology', 'Provider'],
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
      Method: getValue(entry.method || entry.technique),
      Pathology: getValue(entry.pathology || entry.findings),
      Provider: getValue(entry.provider)
    }));
  }
};
