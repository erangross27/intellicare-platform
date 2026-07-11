module.exports = {
  title: '❤️‍🩹 Cardiac Rehabilitation',
  columns: ['Date', 'Session', 'Exercise Level', 'Response', 'Therapist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Session: getValue(entry.session || entry.sessionNumber),
      'Exercise Level': getValue(entry.exerciseLevel || entry.intensity),
      Response: getValue(entry.response || entry.tolerance),
      Therapist: getValue(entry.therapist || entry.provider)
    }));
  }
};
