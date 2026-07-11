module.exports = {
  title: '🕊️ Palliative Care',
  columns: ['Date', 'Symptoms', 'Goals of Care', 'Recommendations', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Symptoms: getValue(entry.symptoms || entry.symptomBurden),
      'Goals of Care': getValue(entry.goalsOfCare || entry.goals),
      Recommendations: getValue(entry.recommendations || entry.plan),
      Provider: getValue(entry.provider)
    }));
  }
};
