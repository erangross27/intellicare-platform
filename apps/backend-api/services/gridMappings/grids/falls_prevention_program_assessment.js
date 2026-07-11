module.exports = {
  title: '⚠️ Falls Prevention Program Assessment',
  columns: ['Date', 'Risk Score', 'Risk Level', 'Interventions', 'Assessor'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Risk Score': getValue(entry.riskScore || entry.score),
      'Risk Level': getValue(entry.riskLevel || entry.level),
      Interventions: getValue(entry.interventions || entry.plan),
      Assessor: getValue(entry.assessor || entry.provider)
    }));
  }
};
