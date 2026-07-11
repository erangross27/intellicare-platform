module.exports = {
  title: '🦵 Peripheral Neuropathy',
  columns: ['Date', 'Distribution', 'Severity', 'Cause', 'Neurologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Distribution: getValue(entry.distribution || entry.pattern),
      Severity: getValue(entry.severity || entry.grade),
      Cause: getValue(entry.cause || entry.etiology),
      Neurologist: getValue(entry.neurologist || entry.provider)
    }));
  }
};
