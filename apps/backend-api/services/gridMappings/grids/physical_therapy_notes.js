module.exports = {
  title: '🏃 Physical Therapy Notes',
  columns: ['Date', 'Exercises', 'Progress', 'Pain Level', 'Physical Therapist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Exercises: getValue(entry.exercises || entry.interventions),
      Progress: getValue(entry.progress || entry.status),
      'Pain Level': getValue(entry.painLevel || entry.pain),
      'Physical Therapist': getValue(entry.physicalTherapist || entry.provider)
    }));
  }
};
