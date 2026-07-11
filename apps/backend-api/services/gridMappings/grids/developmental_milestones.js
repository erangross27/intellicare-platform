module.exports = {
  title: '👶 Developmental Milestones',
  columns: ['Date', 'Age', 'Milestone', 'Achieved', 'Notes'],
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
      Milestone: getValue(entry.milestone || entry.skill),
      Achieved: getValue(entry.achieved || entry.status, 'No'),
      Notes: getValue(entry.notes || entry.comments)
    }));
  }
};
