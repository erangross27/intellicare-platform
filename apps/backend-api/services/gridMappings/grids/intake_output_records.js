module.exports = {
  title: '💧 Intake & Output Records',
  columns: ['Date/Time', 'Intake', 'Output', 'Balance', 'Nurse'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.dateTime || entry.date ? new Date(entry.dateTime || entry.date).toLocaleString() : '-',
      Intake: getValue(entry.intake || entry.totalIntake),
      Output: getValue(entry.output || entry.totalOutput),
      Balance: getValue(entry.balance || entry.netBalance),
      Nurse: getValue(entry.nurse || entry.provider)
    }));
  }
};
