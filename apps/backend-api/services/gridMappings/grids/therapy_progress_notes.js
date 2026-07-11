module.exports = {
  title: '📊 Therapy Progress Notes',
  columns: ['Date', 'Therapy Type', 'Progress', 'Goals', 'Therapist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Therapy Type': getValue(entry.therapyType || entry.type),
      Progress: getValue(entry.progress || entry.status),
      Goals: getValue(entry.goals || entry.objectives),
      Therapist: getValue(entry.therapist || entry.provider)
    }));
  }
};
