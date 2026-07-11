module.exports = {
  title: '⚠️ GDM Recurrence Risk',
  columns: ['Date', 'Risk Factors', 'Risk Level', 'Prevention Plan', 'Endocrinologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Risk Factors': getValue(entry.riskFactors || entry.factors),
      'Risk Level': getValue(entry.riskLevel || entry.risk),
      'Prevention Plan': getValue(entry.preventionPlan || entry.plan),
      Endocrinologist: getValue(entry.endocrinologist || entry.provider)
    }));
  }
};
