module.exports = {
  title: '💬 Language Development',
  columns: ['Date', 'Age', 'Milestone', 'Assessment', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Age: getValue(entry.age || entry.ageMonths),
      Milestone: getValue(entry.milestone || entry.languageSkill),
      Assessment: getValue(entry.assessment || entry.findings),
      Provider: getValue(entry.provider)
    }));
  }
};
