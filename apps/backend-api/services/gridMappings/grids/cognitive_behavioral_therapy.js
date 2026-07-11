module.exports = {
  title: '🧠 Cognitive Behavioral Therapy',
  columns: ['Date', 'Session', 'Topic', 'Progress', 'Therapist'],
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
      Topic: getValue(entry.topic || entry.focus),
      Progress: getValue(entry.progress || entry.outcome),
      Therapist: getValue(entry.therapist || entry.provider)
    }));
  }
};
