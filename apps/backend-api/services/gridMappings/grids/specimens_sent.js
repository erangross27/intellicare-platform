module.exports = {
  title: '🧪 Specimens Sent',
  columns: ['Date', 'Specimen Type', 'Site', 'Lab', 'Provider'],
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
      Lab: getValue(entry.lab || entry.destination),
      Provider: getValue(entry.provider)
    }));
  }
};
