module.exports = {
  title: '🔪 Orthopedic Procedures',
  columns: ['Date', 'Procedure', 'Site', 'Technique', 'Orthopedic Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Procedure: getValue(entry.procedure || entry.operation),
      Site: getValue(entry.site || entry.location),
      Technique: getValue(entry.technique || entry.approach),
      'Orthopedic Surgeon': getValue(entry.orthopedicSurgeon || entry.provider)
    }));
  }
};
