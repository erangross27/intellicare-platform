module.exports = {
  title: '🦵 Compression Therapy',
  columns: ['Date', 'Type', 'Location', 'Pressure', 'Compliance'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Type: getValue(entry.type || entry.compressionType),
      Location: getValue(entry.location || entry.site),
      Pressure: getValue(entry.pressure || entry.mmHg),
      Compliance: getValue(entry.compliance || entry.adherence)
    }));
  }
};
