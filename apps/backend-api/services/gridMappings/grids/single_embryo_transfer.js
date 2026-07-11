module.exports = {
  title: '🧬 Single Embryo Transfer',
  columns: ['Date', 'Embryo Grade', 'Transfer Day', 'Result', 'Specialist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Embryo Grade': getValue(entry.embryoGrade || entry.quality),
      'Transfer Day': getValue(entry.transferDay || entry.day),
      Result: getValue(entry.result || entry.outcome),
      Specialist: getValue(entry.specialist || entry.provider)
    }));
  }
};
