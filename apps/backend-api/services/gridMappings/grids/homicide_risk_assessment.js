module.exports = {
  title: '⚠️ Homicide Risk Assessment',
  columns: ['Date', 'Risk Level', 'Factors', 'Safety Plan', 'Assessor'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Risk Level': getValue(entry.riskLevel || entry.level),
      Factors: getValue(entry.factors || entry.riskFactors),
      'Safety Plan': getValue(entry.safetyPlan || entry.interventions),
      Assessor: getValue(entry.assessor || entry.provider)
    }));
  }
};
