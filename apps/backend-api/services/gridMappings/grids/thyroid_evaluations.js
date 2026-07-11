module.exports = {
  title: '🦋 Thyroid Evaluations',
  columns: ['Date', 'TSH', 'Free T4', 'Free T3', 'Endocrinologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      TSH: getValue(entry.tsh || entry.TSH),
      'Free T4': getValue(entry.freeT4 || entry.T4),
      'Free T3': getValue(entry.freeT3 || entry.T3),
      Endocrinologist: getValue(entry.endocrinologist || entry.provider)
    }));
  }
};
