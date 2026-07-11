module.exports = {
  title: '🫁 Arterial Blood Gases',
  columns: ['Date/Time', 'pH', 'PaCO2', 'PaO2', 'HCO3'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      pH: getValue(entry.ph || entry.pH),
      PaCO2: getValue(entry.paco2 || entry.PaCO2),
      PaO2: getValue(entry.pao2 || entry.PaO2),
      HCO3: getValue(entry.hco3 || entry.HCO3 || entry.bicarbonate)
    }));
  }
};
