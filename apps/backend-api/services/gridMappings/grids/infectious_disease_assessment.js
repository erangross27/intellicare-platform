module.exports = {
  title: '🦠 Infectious Disease Assessment',
  columns: ['Date', 'Infection', 'Severity', 'Treatment', 'Status'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Infection: getValue(entry.infection || entry.diagnosis),
      Severity: getValue(entry.severity || entry.stage),
      Treatment: getValue(entry.treatment || entry.medications),
      Status: getValue(entry.status || entry.resolution)
    }));
  }
};
