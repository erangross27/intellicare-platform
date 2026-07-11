module.exports = {
  title: '🥗 Renal Nutrition',
  columns: ['Date', 'Diet Type', 'Protein', 'Restrictions', 'Renal Dietitian'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Diet Type': getValue(entry.dietType || entry.diet),
      Protein: getValue(entry.protein || entry.proteinIntake),
      Restrictions: getValue(entry.restrictions || entry.limits),
      'Renal Dietitian': getValue(entry.renalDietitian || entry.provider)
    }));
  }
};
