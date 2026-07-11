module.exports = {
  title: '📋 Postoperative Orders',
  columns: ['Date', 'Activity', 'Diet', 'Medications', 'Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Activity: getValue(entry.activity || entry.mobilization),
      Diet: getValue(entry.diet || entry.nutrition),
      Medications: getValue(entry.medications || entry.drugs),
      Surgeon: getValue(entry.surgeon || entry.provider)
    }));
  }
};
