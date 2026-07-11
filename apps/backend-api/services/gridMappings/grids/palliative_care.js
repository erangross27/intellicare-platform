module.exports = {
  title: '🕊️ Palliative Care',
  columns: ['Date', 'Symptom Management', 'Goals of Care', 'Services', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Symptom Management': getValue(entry.symptomManagement || entry.symptoms),
      'Goals of Care': getValue(entry.goalsOfCare || entry.goals),
      Services: getValue(entry.services || entry.interventions),
      Provider: getValue(entry.provider)
    }));
  }
};
