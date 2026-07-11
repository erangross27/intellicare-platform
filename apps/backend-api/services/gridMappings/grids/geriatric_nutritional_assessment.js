module.exports = {
  title: '🍎 Nutritional Assessment',
  columns: ['Date', 'Weight', 'BMI', 'Risk Score', 'Interventions'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Weight: getValue(entry.weight),
      BMI: getValue(entry.bmi),
      'Risk Score': getValue(entry.riskScore || entry.mna),
      Interventions: getValue(entry.interventions || entry.plan)
    }));
  }
};
