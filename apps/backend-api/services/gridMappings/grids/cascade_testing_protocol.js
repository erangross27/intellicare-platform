module.exports = {
  title: '🧬 Cascade Testing Protocol',
  columns: ['Date', 'Family Member', 'Relationship', 'Testing Status', 'Result'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Family Member': getValue(entry.familyMember || entry.name),
      Relationship: getValue(entry.relationship || entry.relation),
      'Testing Status': getValue(entry.testingStatus || entry.status),
      Result: getValue(entry.result || entry.outcome)
    }));
  }
};
