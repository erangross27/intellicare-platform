module.exports = {
  title: '🧠 Neurological Examination',
  columns: ['Date', 'System', 'Findings', 'Abnormalities', 'Neurologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      System: getValue(entry.system || entry.category),
      Findings: getValue(entry.findings || entry.examination),
      Abnormalities: getValue(entry.abnormalities || entry.deficits),
      Neurologist: getValue(entry.neurologist || entry.provider)
    }));
  }
};
