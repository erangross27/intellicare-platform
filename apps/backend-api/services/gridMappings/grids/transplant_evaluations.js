module.exports = {
  title: '🫘 Transplant Evaluations',
  columns: ['Date', 'Evaluation Status', 'Findings', 'Recommendation', 'Transplant Specialist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Evaluation Status': getValue(entry.evaluationStatus || entry.status),
      Findings: getValue(entry.findings || entry.assessment),
      Recommendation: getValue(entry.recommendation || entry.decision),
      'Transplant Specialist': getValue(entry.transplantSpecialist || entry.provider)
    }));
  }
};
