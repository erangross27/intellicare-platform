module.exports = {
  title: '🧬 Single Embryo Transfer Details',
  columns: ['Date', 'Embryo Quality', 'Day of Transfer', 'Outcome', 'Fertility Specialist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Embryo Quality': getValue(entry.embryoQuality || entry.grade),
      'Day of Transfer': getValue(entry.dayOfTransfer || entry.day),
      Outcome: getValue(entry.outcome || entry.result),
      'Fertility Specialist': getValue(entry.fertilitySpecialist || entry.provider)
    }));
  }
};
