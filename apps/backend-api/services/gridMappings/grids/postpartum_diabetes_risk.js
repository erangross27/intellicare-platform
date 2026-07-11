module.exports = {
  title: '⚠️ Postpartum Diabetes Risk',
  columns: ['Date', 'Risk Level', 'Screening Plan', 'Prevention', 'Endocrinologist'],
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
      'Screening Plan': getValue(entry.screeningPlan || entry.monitoring),
      Prevention: getValue(entry.prevention || entry.recommendations),
      Endocrinologist: getValue(entry.endocrinologist || entry.provider)
    }));
  }
};
