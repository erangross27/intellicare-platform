module.exports = {
  title: '🥗 Dietary Interventions',
  columns: ['Date', 'Intervention', 'Dietary Goal', 'Compliance', 'Dietitian'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Intervention: getValue(entry.intervention || entry.diet || entry.plan),
      'Dietary Goal': getValue(entry.dietaryGoal || entry.goal),
      Compliance: getValue(entry.compliance || entry.adherence),
      Dietitian: getValue(entry.dietitian || entry.provider)
    }));
  }
};
