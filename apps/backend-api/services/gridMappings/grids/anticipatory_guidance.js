module.exports = {
  title: '📚 Anticipatory Guidance',
  columns: ['Date', 'Age', 'Topics Discussed', 'Resources', 'Pediatrician'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Age: getValue(entry.age || entry.childAge),
      'Topics Discussed': getValue(entry.topicsDiscussed || entry.topics),
      Resources: getValue(entry.resources || entry.handouts),
      Pediatrician: getValue(entry.pediatrician || entry.provider)
    }));
  }
};
