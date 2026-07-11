module.exports = {
  title: '🚶 Fall Prevention Education',
  columns: ['Date', 'Topic', 'Method', 'Understanding', 'Educator'],
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
      Method: getValue(entry.method || entry.format),
      Understanding: getValue(entry.understanding || entry.comprehension),
      Educator: getValue(entry.educator || entry.provider)
    }));
  }
};
