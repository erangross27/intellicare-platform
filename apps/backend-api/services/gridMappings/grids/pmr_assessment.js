module.exports = {
  title: '🏥 PMR Assessment',
  columns: ['Date', 'Functional Status', 'Limitations', 'Goals', 'Physiatrist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Functional Status': getValue(entry.functionalStatus || entry.status),
      Limitations: getValue(entry.limitations || entry.restrictions),
      Goals: getValue(entry.goals || entry.objectives),
      Physiatrist: getValue(entry.physiatrist || entry.provider)
    }));
  }
};
