module.exports = {
  title: '🤝 Social & Functional Assessment',
  columns: ['Date', 'Social Support', 'Functional Status', 'Needs', 'Social Worker'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Social Support': getValue(entry.socialSupport || entry.support),
      'Functional Status': getValue(entry.functionalStatus || entry.adl),
      Needs: getValue(entry.needs || entry.concerns),
      'Social Worker': getValue(entry.socialWorker || entry.provider)
    }));
  }
};
