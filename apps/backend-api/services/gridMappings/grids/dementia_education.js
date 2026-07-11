module.exports = {
  title: '🧠 Dementia Education',
  columns: ['Date', 'Topic', 'Attendees', 'Method', 'Understanding'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Topic: getValue(entry.topic || entry.subject),
      Attendees: getValue(entry.attendees || entry.participants),
      Method: getValue(entry.method || entry.format),
      Understanding: getValue(entry.understanding || entry.comprehension)
    }));
  }
};
