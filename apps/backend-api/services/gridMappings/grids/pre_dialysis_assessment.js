module.exports = {
  title: '💧 Pre-Dialysis Assessment',
  columns: ['Date', 'Weight', 'Blood Pressure', 'Access Site', 'Nurse'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Weight: getValue(entry.weight || entry.preWeight),
      'Blood Pressure': getValue(entry.bloodPressure || entry.bp),
      'Access Site': getValue(entry.accessSite || entry.site),
      Nurse: getValue(entry.nurse || entry.provider)
    }));
  }
};
