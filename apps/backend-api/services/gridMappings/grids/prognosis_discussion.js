module.exports = {
  title: '💬 Prognosis Discussion',
  columns: ['Date', 'Topics', 'Patient Understanding', 'Questions', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Topics: getValue(entry.topics || entry.topicsDiscussed),
      'Patient Understanding': getValue(entry.patientUnderstanding || entry.comprehension),
      Questions: getValue(entry.questions || entry.patientQuestions),
      Provider: getValue(entry.provider)
    }));
  }
};
