module.exports = {
  title: '🫁 Pulmonary Rehabilitation',
  columns: ['Date', 'Program Components', 'Progress', 'Goals', 'Therapist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Program Components': getValue(entry.programComponents || entry.activities),
      Progress: getValue(entry.progress || entry.improvement),
      Goals: getValue(entry.goals || entry.targets),
      Therapist: getValue(entry.therapist || entry.provider)
    }));
  }
};
