module.exports = {
  title: '🤰 Reproductive History',
  columns: ['Date', 'Gravida', 'Para', 'Pregnancy Outcomes', 'Obstetrician'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Gravida: getValue(entry.gravida || entry.g),
      Para: getValue(entry.para || entry.p),
      'Pregnancy Outcomes': getValue(entry.pregnancyOutcomes || entry.outcomes),
      Obstetrician: getValue(entry.obstetrician || entry.provider)
    }));
  }
};
