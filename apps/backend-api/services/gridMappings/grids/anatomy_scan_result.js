module.exports = {
  title: '🔍 Anatomy Scan Result',
  columns: ['Date', 'Gestational Age', 'Fetal Anatomy', 'Findings', 'Sonographer'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Gestational Age': getValue(entry.gestationalAge || entry.ga),
      'Fetal Anatomy': getValue(entry.fetalAnatomy || entry.anatomy),
      Findings: getValue(entry.findings || entry.results),
      Sonographer: getValue(entry.sonographer || entry.provider)
    }));
  }
};
