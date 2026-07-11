module.exports = {
  title: '💤 Anesthesia',
  columns: ['Date', 'Anesthesia Type', 'Intubation', 'Monitoring', 'Complications'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    const getArrayValue = (arr) => {
      if (!Array.isArray(arr) || arr.length === 0) return '-';
      return arr.join(', ');
    };
    return categoryData.map(entry => ({
      Date: entry.surgeryDate ? new Date(entry.surgeryDate).toLocaleDateString() :
            entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Anesthesia Type': getValue(entry.anesthesiaType || entry.type),
      Intubation: getValue(entry.intubationType || entry.intubation),
      Monitoring: getArrayValue(entry.monitoring),
      Complications: getArrayValue(entry.complications)
    }));
  }
};
