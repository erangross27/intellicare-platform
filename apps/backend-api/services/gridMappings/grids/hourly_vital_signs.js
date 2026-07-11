module.exports = {
  title: '⏱️ Hourly Vital Signs',
  columns: ['Time', 'BP', 'HR', 'Temp', 'RR', 'SpO2'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Time: entry.date ? new Date(entry.date).toLocaleTimeString() : '-',
      BP: getValue(entry.bloodPressure || entry.bp),
      HR: getValue(entry.heartRate || entry.pulse),
      Temp: getValue(entry.temperature || entry.temp),
      RR: getValue(entry.respiratoryRate || entry.respRate),
      SpO2: getValue(entry.oxygenSaturation || entry.spo2)
    }));
  }
};
