module.exports = {
  title: '👨‍👩‍👧 Parenting Education',
  columns: ['Date', 'Topic', 'Materials Provided', 'Understanding', 'Educator'],
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
      'Materials Provided': getValue(entry.materialsProvided || entry.materials),
      Understanding: getValue(entry.understanding || entry.comprehension),
      Educator: getValue(entry.educator || entry.provider)
    }));
  }
};
