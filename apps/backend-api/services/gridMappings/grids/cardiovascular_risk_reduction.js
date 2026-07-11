module.exports = {
  title: '❤️ Cardiovascular Risk Reduction',
  columns: ['Date', 'Risk Factor', 'Intervention', 'Target', 'Status'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Risk Factor': getValue(entry.riskFactor || entry.factor),
      Intervention: getValue(entry.intervention || entry.strategy),
      Target: getValue(entry.target || entry.goal),
      Status: getValue(entry.status || entry.progress)
    }));
  }
};
