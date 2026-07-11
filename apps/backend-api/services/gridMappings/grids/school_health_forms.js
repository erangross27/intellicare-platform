module.exports = {
  title: '🎓 School Health Forms',
  columns: ['Date', 'Form Type', 'Clearance', 'Restrictions', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Form Type': getValue(entry.formType || entry.type),
      Clearance: getValue(entry.clearance || entry.status),
      Restrictions: getValue(entry.restrictions || entry.limitations),
      Provider: getValue(entry.provider)
    }));
  }
};
