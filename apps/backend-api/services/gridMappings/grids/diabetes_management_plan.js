module.exports = {
  title: '💉 Diabetes Management Plan',
  columns: ['Date', 'Medications', 'Monitoring', 'Targets', 'Endocrinologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Medications: getValue(entry.medications || entry.drugs),
      Monitoring: getValue(entry.monitoring || entry.testing),
      Targets: getValue(entry.targets || entry.goals),
      Endocrinologist: getValue(entry.endocrinologist || entry.provider)
    }));
  }
};
