module.exports = {
  title: '📚 Diabetes Education',
  columns: ['Date', 'Topic', 'Materials', 'Understanding', 'Educator'],
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
      Materials: getValue(entry.materials || entry.resourcesProvided),
      Understanding: getValue(entry.understanding || entry.comprehension),
      Educator: getValue(entry.educator || entry.provider)
    }));
  }
};
