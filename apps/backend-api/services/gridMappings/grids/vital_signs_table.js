module.exports = {
  title: '📈 Vital Signs Table',
  columns: ['Date/Time', 'BP', 'HR', 'Temp', 'RR', 'SpO2'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      BP: getValue(entry.bloodPressure || entry.bp),
      HR: getValue(entry.heartRate || entry.pulse),
      Temp: getValue(entry.temperature),
      RR: getValue(entry.respiratoryRate || entry.respRate),
      SpO2: getValue(entry.oxygenSaturation || entry.spo2)
    }));
  }
};
