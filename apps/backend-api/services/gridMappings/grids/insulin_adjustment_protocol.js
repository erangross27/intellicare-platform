module.exports = {
  title: '💉 Insulin Adjustment Protocol',
  columns: ['Date', 'Current Dose', 'New Dose', 'Glucose Levels', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Current Dose': getValue(entry.currentDose || entry.oldDose),
      'New Dose': getValue(entry.newDose || entry.adjustedDose),
      'Glucose Levels': getValue(entry.glucoseLevels || entry.bloodSugar),
      Provider: getValue(entry.provider)
    }));
  }
};
