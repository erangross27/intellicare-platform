module.exports = {
  title: '💧 Fluid & Electrolyte Management',
  columns: ['Date/Time', 'Fluids', 'Electrolytes', 'Balance', 'Plan'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      Fluids: getValue(entry.fluids || entry.ivFluids),
      Electrolytes: getValue(entry.electrolytes || entry.labs),
      Balance: getValue(entry.balance || entry.status),
      Plan: getValue(entry.plan || entry.management)
    }));
  }
};
