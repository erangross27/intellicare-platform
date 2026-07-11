module.exports = {
  title: '🩸 Coagulation Studies',
  columns: ['Date', 'PT/INR', 'PTT', 'Platelets', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'PT/INR': getValue(entry.ptInr || entry.inr || entry.PT),
      PTT: getValue(entry.ptt || entry.PTT || entry.aPTT),
      Platelets: getValue(entry.platelets || entry.plateletCount),
      Provider: getValue(entry.provider)
    }));
  }
};
