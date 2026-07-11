module.exports = {
  title: '🔬 Lab Schedule',
  columns: ['Date', 'Labs Ordered', 'Frequency', 'Next Due', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Labs Ordered': getValue(entry.labsOrdered || entry.tests),
      Frequency: getValue(entry.frequency || entry.schedule),
      'Next Due': getValue(entry.nextDue || entry.dueDate),
      Provider: getValue(entry.provider)
    }));
  }
};
