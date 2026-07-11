module.exports = {
  title: '🖐️ Occupational Therapy Reports',
  columns: ['Date', 'Activities', 'Progress', 'Goals', 'Occupational Therapist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Activities: getValue(entry.activities || entry.interventions),
      Progress: getValue(entry.progress || entry.status),
      Goals: getValue(entry.goals || entry.objectives),
      'Occupational Therapist': getValue(entry.occupationalTherapist || entry.provider)
    }));
  }
};
