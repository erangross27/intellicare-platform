module.exports = {
  title: '💧 Post-Dialysis Assessment',
  columns: ['Date', 'Weight', 'Blood Pressure', 'Complications', 'Nurse'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Weight: getValue(entry.weight || entry.postWeight),
      'Blood Pressure': getValue(entry.bloodPressure || entry.bp),
      Complications: getValue(entry.complications || entry.issues),
      Nurse: getValue(entry.nurse || entry.provider)
    }));
  }
};
