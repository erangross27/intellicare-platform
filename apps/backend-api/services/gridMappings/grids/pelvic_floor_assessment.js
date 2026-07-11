module.exports = {
  title: '🩺 Pelvic Floor Assessment',
  columns: ['Date', 'Muscle Strength', 'Prolapse', 'Recommendations', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Muscle Strength': getValue(entry.muscleStrength || entry.strength),
      Prolapse: getValue(entry.prolapse || entry.prolapseGrade),
      Recommendations: getValue(entry.recommendations || entry.plan),
      Provider: getValue(entry.provider)
    }));
  }
};
