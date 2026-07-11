module.exports = {
  title: '⚠️ Pregnancy Risk Assessment',
  columns: ['Date', 'Risk Factors', 'Risk Level', 'Management Plan', 'Obstetrician'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Risk Factors': getValue(entry.riskFactors || entry.risks),
      'Risk Level': getValue(entry.riskLevel || entry.level),
      'Management Plan': getValue(entry.managementPlan || entry.plan),
      Obstetrician: getValue(entry.obstetrician || entry.provider)
    }));
  }
};
