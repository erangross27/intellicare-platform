module.exports = {
  title: '🍛 South Asian Nutritionist',
  columns: ['Date', 'Dietary Assessment', 'Cultural Considerations', 'Plan', 'Nutritionist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Dietary Assessment': getValue(entry.dietaryAssessment || entry.assessment),
      'Cultural Considerations': getValue(entry.culturalConsiderations || entry.cultural),
      Plan: getValue(entry.plan || entry.recommendations),
      Nutritionist: getValue(entry.nutritionist || entry.provider)
    }));
  }
};
