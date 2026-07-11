module.exports = {
  title: '⚖️ Inter-Pregnancy Weight Management',
  columns: ['Date', 'Current Weight', 'Target Weight', 'Plan', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Current Weight': getValue(entry.currentWeight || entry.weight),
      'Target Weight': getValue(entry.targetWeight || entry.goal),
      Plan: getValue(entry.plan || entry.strategy),
      Provider: getValue(entry.provider)
    }));
  }
};
