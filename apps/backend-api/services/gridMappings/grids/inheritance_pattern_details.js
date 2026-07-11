module.exports = {
  title: '🧬 Inheritance Pattern Details',
  columns: ['Date', 'Pattern', 'Risk Assessment', 'Family History', 'Geneticist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Pattern: getValue(entry.pattern || entry.inheritanceType),
      'Risk Assessment': getValue(entry.riskAssessment || entry.risk),
      'Family History': getValue(entry.familyHistory || entry.pedigree),
      Geneticist: getValue(entry.geneticist || entry.provider)
    }));
  }
};
