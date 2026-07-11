module.exports = {
  title: '👥 Team Notes',
  columns: ['Date', 'Discipline', 'Assessment', 'Recommendations', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Discipline: getValue(entry.discipline || entry.specialty),
      Assessment: getValue(entry.assessment || entry.findings),
      Recommendations: getValue(entry.recommendations || entry.plan),
      Provider: getValue(entry.provider)
    }));
  }
};
