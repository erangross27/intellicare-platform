module.exports = {
  title: '📚 Diabetes Educator Training',
  columns: ['Date', 'Topic', 'Skills Taught', 'Competency', 'Educator'],
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
      Competency: getValue(entry.competency || entry.mastery),
      Educator: getValue(entry.educator || entry.provider)
    }));
  }
};
