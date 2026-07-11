module.exports = {
  title: '💊 Cancer Treatment',
  columns: ['Date', 'Treatment Type', 'Agent/Dose', 'Cycle', 'Side Effects'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : (entry.treatmentDate ? new Date(entry.treatmentDate).toLocaleDateString() : '-'),
      'Treatment Type': getValue(entry.treatmentType || entry.regimen || entry.protocol),
      'Agent/Dose': getValue(entry.agent || entry.medication || entry.dose),
      Cycle: getValue(entry.cycle || entry.dayOfCycle),
      'Side Effects': getValue(entry.sideEffects || entry.toxicity || entry.adverseEvents)
    }));
  }
};
