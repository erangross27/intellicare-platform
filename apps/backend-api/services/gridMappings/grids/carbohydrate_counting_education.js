module.exports = {
  title: '🍽️ Carbohydrate Counting Education',
  columns: ['Date', 'Topic', 'Understanding', 'Resources', 'Educator'],
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
      Understanding: getValue(entry.understanding || entry.comprehension),
      Resources: getValue(entry.resources || entry.materialsProvided),
      Educator: getValue(entry.educator || entry.provider)
    }));
  }
};
