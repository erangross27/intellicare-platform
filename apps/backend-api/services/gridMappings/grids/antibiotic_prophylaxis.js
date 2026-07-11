module.exports = {
  title: '💊 Antibiotic Prophylaxis',
  columns: ['Date', 'Antibiotic', 'Dosage', 'Timing', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Antibiotic: getValue(entry.antibiotic || entry.medication),
      Dosage: getValue(entry.dosage || entry.dose),
      Timing: getValue(entry.timing || entry.schedule),
      Provider: getValue(entry.provider)
    }));
  }
};
