module.exports = {
  title: '💧 Intradialytic Monitoring',
  columns: ['Time', 'Blood Pressure', 'Heart Rate', 'Ultrafiltration', 'Nurse'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Time: entry.time ? entry.time : '-',
      'Blood Pressure': getValue(entry.bloodPressure || entry.bp),
      'Heart Rate': getValue(entry.heartRate || entry.hr),
      Ultrafiltration: getValue(entry.ultrafiltration || entry.uf),
      Nurse: getValue(entry.nurse || entry.provider)
    }));
  }
};
