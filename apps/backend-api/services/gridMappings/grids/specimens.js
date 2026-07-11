module.exports = {
  title: '🔬 Specimens',
  columns: ['Date', 'Specimen Type', 'Site', 'Pathology Sent', 'Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Specimen Type': getValue(entry.specimenType || entry.type),
      Site: getValue(entry.site || entry.location),
      'Pathology Sent': getValue(entry.pathologySent || entry.sent),
      Surgeon: getValue(entry.surgeon || entry.provider)
    }));
  }
};
