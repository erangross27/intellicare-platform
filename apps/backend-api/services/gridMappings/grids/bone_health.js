module.exports = {
  title: '🦴 Bone Health',
  columns: ['Date', 'Bone Density', 'T-Score', 'Risk Assessment', 'Treatment'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Bone Density': getValue(entry.boneDensity || entry.bmd),
      'T-Score': getValue(entry.tScore || entry.tscore),
      'Risk Assessment': getValue(entry.riskAssessment || entry.frax),
      Treatment: getValue(entry.treatment || entry.plan)
    }));
  }
};
