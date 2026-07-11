module.exports = {
  title: '📋 Advance Directive Discussion',
  columns: ['Date', 'Topics Discussed', 'Decisions', 'Documents', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Topics Discussed': getValue(entry.topicsDiscussed || entry.topics),
      Decisions: getValue(entry.decisions || entry.preferences),
      Documents: getValue(entry.documents || entry.formsCompleted),
      Provider: getValue(entry.provider)
    }));
  }
};
