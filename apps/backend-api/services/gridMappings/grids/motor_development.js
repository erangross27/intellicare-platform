module.exports = {
  title: '🚼 Motor Development',
  columns: ['Date', 'Age', 'Milestone', 'Achievement', 'Provider'],
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
      Milestone: getValue(entry.milestone || entry.motorSkill),
      Achievement: getValue(entry.achievement || entry.status),
      Provider: getValue(entry.provider)
    }));
  }
};
