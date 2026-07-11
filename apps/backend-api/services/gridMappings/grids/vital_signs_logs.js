module.exports = {
  title: '📊 Vital Signs Logs',
  columns: ['Date/Time', 'BP', 'HR', 'Temp', 'SpO2'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.dateTime || entry.date ? new Date(entry.dateTime || entry.date).toLocaleString() : '-',
      BP: getValue(entry.bp || entry.bloodPressure),
      HR: getValue(entry.hr || entry.heartRate),
      Temp: getValue(entry.temp || entry.temperature),
      SpO2: getValue(entry.spo2 || entry.oxygenSaturation)
    }));
  }
};
