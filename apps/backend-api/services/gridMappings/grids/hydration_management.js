module.exports = {
  title: '💧 Hydration Management',
  columns: ['Date', 'Intake', 'Output', 'Balance', 'Status'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Intake: getValue(entry.intake || entry.fluidIntake),
      Output: getValue(entry.output || entry.fluidOutput),
      Balance: getValue(entry.balance || entry.netBalance),
      Status: getValue(entry.status || entry.hydrationStatus)
    }));
  }
};
