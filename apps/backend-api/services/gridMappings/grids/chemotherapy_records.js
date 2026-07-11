module.exports = {
  title: '💊 Chemotherapy Records',
  columns: ['Date', 'Regimen', 'Cycle', 'Side Effects', 'Oncologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Regimen: getValue(entry.regimen || entry.protocol),
      Cycle: getValue(entry.cycle || entry.cycleNumber),
      'Side Effects': getValue(entry.sideEffects || entry.toxicity),
      Oncologist: getValue(entry.oncologist || entry.provider)
    }));
  }
};
