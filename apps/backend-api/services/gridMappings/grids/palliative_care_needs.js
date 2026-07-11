module.exports = {
  title: '🕊️ Palliative Care Needs',
  columns: ['Date', 'Symptoms', 'Goals of Care', 'Interventions', 'Palliative Team'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Symptoms: getValue(entry.symptoms || entry.symptomBurden),
      'Goals of Care': getValue(entry.goalsOfCare || entry.goals),
      Interventions: getValue(entry.interventions || entry.plan),
      'Palliative Team': getValue(entry.palliativeTeam || entry.provider)
    }));
  }
};
