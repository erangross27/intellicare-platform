module.exports = {
  title: '🧒 Early Childhood Development',
  columns: ['Date', 'Age', 'Milestones', 'Assessment', 'Provider'],
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
      Milestones: getValue(entry.milestones || entry.achievements),
      Assessment: getValue(entry.assessment || entry.evaluation),
      Provider: getValue(entry.provider)
    }));
  }
};
