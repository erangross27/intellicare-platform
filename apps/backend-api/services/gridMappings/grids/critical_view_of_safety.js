module.exports = {
  title: '🔪 Critical View of Safety',
  columns: ['Date', 'Procedure', 'CVS Achieved', 'Structures Identified', 'Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Procedure: getValue(entry.procedure || entry.operation),
      'CVS Achieved': getValue(entry.cvsAchieved || entry.achieved, 'Yes'),
      'Structures Identified': getValue(entry.structuresIdentified || entry.structures),
      Surgeon: getValue(entry.surgeon || entry.provider)
    }));
  }
};
