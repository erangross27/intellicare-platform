module.exports = {
  title: '🤕 Headache Assessment',
  columns: ['Date', 'Type', 'Frequency', 'Severity', 'Neurologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Type: getValue(entry.type || entry.headacheType),
      Frequency: getValue(entry.frequency || entry.howOften),
      Severity: getValue(entry.severity || entry.painLevel),
      Neurologist: getValue(entry.neurologist || entry.provider)
    }));
  }
};
