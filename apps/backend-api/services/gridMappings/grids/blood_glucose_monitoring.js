module.exports = {
  title: '📊 Blood Glucose Monitoring',
  columns: ['Date/Time', 'Glucose Level', 'Meal Context', 'Insulin Given', 'Nurse'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.dateTime || entry.date ? new Date(entry.dateTime || entry.date).toLocaleString() : '-',
      'Glucose Level': getValue(entry.glucoseLevel || entry.glucose),
      'Meal Context': getValue(entry.mealContext || entry.timing),
      'Insulin Given': getValue(entry.insulinGiven || entry.insulin),
      Nurse: getValue(entry.nurse || entry.provider)
    }));
  }
};
