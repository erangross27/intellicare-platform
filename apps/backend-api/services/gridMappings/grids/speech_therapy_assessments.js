module.exports = {
  title: '🗣️ Speech Therapy Assessments',
  columns: ['Date', 'Areas Addressed', 'Progress', 'Goals', 'Speech Therapist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Areas Addressed': getValue(entry.areasAddressed || entry.domains),
      Progress: getValue(entry.progress || entry.status),
      Goals: getValue(entry.goals || entry.objectives),
      'Speech Therapist': getValue(entry.speechTherapist || entry.provider)
    }));
  }
};
