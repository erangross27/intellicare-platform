module.exports = {
  title: '👶 Pediatrics / Well Child',
  columns: ['Date', 'Age', 'Weight', 'Height', 'Milestones'],
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
      Weight: getValue(entry.weight),
      Height: getValue(entry.height || entry.length),
      Milestones: getValue(entry.milestones || entry.developmentalMilestones)
    }));
  }
};
