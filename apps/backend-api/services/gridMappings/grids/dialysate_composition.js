module.exports = {
  title: '💧 Dialysate Composition',
  columns: ['Date', 'Sodium', 'Potassium', 'Calcium', 'Bicarbonate'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Sodium: getValue(entry.sodium || entry.na),
      Potassium: getValue(entry.potassium || entry.k),
      Calcium: getValue(entry.calcium || entry.ca),
      Bicarbonate: getValue(entry.bicarbonate || entry.hco3)
    }));
  }
};
