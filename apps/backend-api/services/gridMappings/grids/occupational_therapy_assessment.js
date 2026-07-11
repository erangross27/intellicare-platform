module.exports = {
  title: '🛠️ Occupational Therapy',
  columns: ['Date', 'Assessment', 'Goals', 'Interventions', 'OT'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Assessment: getValue(entry.assessment || entry.findings),
      Goals: getValue(entry.goals || entry.objectives),
      Interventions: getValue(entry.interventions || entry.treatment),
      OT: getValue(entry.ot || entry.provider)
    }));
  }
};
