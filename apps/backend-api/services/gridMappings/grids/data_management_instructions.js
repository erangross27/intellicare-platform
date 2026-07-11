module.exports = {
  title: '📋 Data Management Instructions',
  columns: ['Date', 'Instruction Type', 'Details', 'Provider', 'Status'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Instruction Type': getValue(entry.instructionType || entry.type),
      Details: getValue(entry.details || entry.instruction),
      Provider: getValue(entry.provider),
      Status: getValue(entry.status, 'Active')
    }));
  }
};
