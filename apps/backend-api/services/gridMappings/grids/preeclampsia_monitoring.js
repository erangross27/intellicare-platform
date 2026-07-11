module.exports = {
  title: '⚠️ Preeclampsia Monitoring',
  columns: ['Date', 'Blood Pressure', 'Proteinuria', 'Symptoms', 'Obstetrician'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Blood Pressure': getValue(entry.bloodPressure || entry.bp),
      Proteinuria: getValue(entry.proteinuria || entry.urine),
      Symptoms: getValue(entry.symptoms || entry.presentation),
      Obstetrician: getValue(entry.obstetrician || entry.provider)
    }));
  }
};
