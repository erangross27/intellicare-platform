module.exports = {
  title: '👶 Children-Specific Risks',
  columns: ['Date', 'Risk Factor', 'Level', 'Screening', 'Intervention'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Risk Factor': getValue(entry.riskFactor || entry.risk),
      Level: getValue(entry.level || entry.severity),
      Screening: getValue(entry.screening || entry.assessment),
      Intervention: getValue(entry.intervention || entry.plan)
    }));
  }
};
