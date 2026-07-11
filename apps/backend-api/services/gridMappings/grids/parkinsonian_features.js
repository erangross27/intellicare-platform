module.exports = {
  title: '🧠 Parkinsonian Features',
  columns: ['Date', 'Tremor', 'Rigidity', 'Bradykinesia', 'Neurologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Tremor: getValue(entry.tremor || entry.tremorSeverity),
      Rigidity: getValue(entry.rigidity || entry.rigiditySeverity),
      Bradykinesia: getValue(entry.bradykinesia || entry.slowness),
      Neurologist: getValue(entry.neurologist || entry.provider)
    }));
  }
};
