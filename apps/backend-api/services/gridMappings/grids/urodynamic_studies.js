module.exports = {
  title: '💧 Urodynamic Studies',
  columns: ['Date', 'Bladder Capacity', 'Flow Rate', 'Findings', 'Urologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Bladder Capacity': getValue(entry.bladderCapacity || entry.capacity),
      'Flow Rate': getValue(entry.flowRate || entry.maxFlowRate),
      Findings: getValue(entry.findings || entry.results),
      Urologist: getValue(entry.urologist || entry.provider)
    }));
  }
};
