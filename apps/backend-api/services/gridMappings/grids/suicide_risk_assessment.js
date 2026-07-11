module.exports = {
  title: '⚠️ Suicide Risk Assessment',
  columns: ['Date', 'Risk Level', 'Protective Factors', 'Safety Plan', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Risk Level': getValue(entry.riskLevel || entry.risk),
      'Protective Factors': getValue(entry.protectiveFactors || entry.protective),
      'Safety Plan': getValue(entry.safetyPlan || entry.plan),
      Provider: getValue(entry.provider)
    }));
  }
};
