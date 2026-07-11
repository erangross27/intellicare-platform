module.exports = {
  title: '🏥 Pre-Operative Preparation',
  columns: ['Date', 'Procedure', 'Preparations', 'Instructions', 'Surgeon'],
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
      Preparations: getValue(entry.preparations || entry.prep),
      Instructions: getValue(entry.instructions || entry.patientInstructions),
      Surgeon: getValue(entry.surgeon || entry.provider)
    }));
  }
};
