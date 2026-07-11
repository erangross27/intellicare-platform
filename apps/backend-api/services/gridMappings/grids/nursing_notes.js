module.exports = {
  title: '👩‍⚕️ Nursing Notes',
  columns: ['Date/Time', 'Assessment', 'Interventions', 'Response', 'Nurse'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      Assessment: getValue(entry.assessment || entry.note),
      Interventions: getValue(entry.interventions || entry.actions),
      Response: getValue(entry.response || entry.outcome),
      Nurse: getValue(entry.nurse || entry.provider)
    }));
  }
};
