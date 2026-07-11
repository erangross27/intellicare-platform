module.exports = {
  title: '💪 Muscle Strength',
  columns: ['Date', 'Muscle Group', 'Left', 'Right', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Muscle Group': getValue(entry.muscleGroup || entry.muscle),
      Left: getValue(entry.left || entry.leftStrength),
      Right: getValue(entry.right || entry.rightStrength),
      Provider: getValue(entry.provider)
    }));
  }
};
