module.exports = {
  title: '💤 Procedural Sedation',
  columns: ['Date', 'Medications', 'Depth', 'Monitoring', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Medications: getValue(entry.medications || entry.sedatives),
      Depth: getValue(entry.depth || entry.sedationLevel),
      Monitoring: getValue(entry.monitoring || entry.vitalsMonitoring),
      Provider: getValue(entry.provider)
    }));
  }
};
