module.exports = {
  title: '🏭 Workers Comp Evaluations',
  columns: ['Date', 'Injury', 'Work Status', 'Restrictions', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Injury: getValue(entry.injury || entry.diagnosis),
      'Work Status': getValue(entry.workStatus || entry.status),
      Restrictions: getValue(entry.restrictions || entry.limitations),
      Provider: getValue(entry.provider)
    }));
  }
};
