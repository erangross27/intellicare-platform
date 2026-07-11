module.exports = {
  title: '👶 Macrosomia Threshold',
  columns: ['Date', 'Estimated Weight', 'Risk Level', 'Plan', 'Obstetrician'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Estimated Weight': getValue(entry.estimatedWeight || entry.efw),
      'Risk Level': getValue(entry.riskLevel || entry.risk),
      Plan: getValue(entry.plan || entry.management),
      Obstetrician: getValue(entry.obstetrician || entry.provider)
    }));
  }
};
