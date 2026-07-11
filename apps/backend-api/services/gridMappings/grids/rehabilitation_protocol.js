module.exports = {
  title: '🏃 Rehabilitation Protocol',
  columns: ['Date', 'Phase', 'Activities', 'Goals', 'Physical Therapist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Phase: getValue(entry.phase || entry.stage),
      Activities: getValue(entry.activities || entry.exercises),
      Goals: getValue(entry.goals || entry.milestones),
      'Physical Therapist': getValue(entry.physicalTherapist || entry.provider)
    }));
  }
};
