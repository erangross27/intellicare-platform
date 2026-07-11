module.exports = {
  title: '🫘 Renal Protection Plan',
  columns: ['Date', 'Medications', 'Hydration', 'Monitoring', 'Nephrologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Medications: getValue(entry.medications || entry.renalProtectiveDrugs),
      Hydration: getValue(entry.hydration || entry.fluids),
      Monitoring: getValue(entry.monitoring || entry.labMonitoring),
      Nephrologist: getValue(entry.nephrologist || entry.provider)
    }));
  }
};
