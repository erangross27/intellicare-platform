module.exports = {
  title: '🛋️ Psychotherapy Notes',
  columns: ['Date', 'Session Type', 'Themes', 'Progress', 'Therapist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Session Type': getValue(entry.sessionType || entry.type),
      Themes: getValue(entry.themes || entry.topics),
      Progress: getValue(entry.progress || entry.assessment),
      Therapist: getValue(entry.therapist || entry.provider)
    }));
  }
};
