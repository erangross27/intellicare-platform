module.exports = {
  title: '💉 Diabetes Education',
  columns: ['Date', 'Topic', 'Skills Taught', 'Understanding', 'Educator'],
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
      'Skills Taught': getValue(entry.skillsTaught || entry.skills),
      Understanding: getValue(entry.understanding || entry.comprehension),
      Educator: getValue(entry.educator || entry.provider)
    }));
  }
};
