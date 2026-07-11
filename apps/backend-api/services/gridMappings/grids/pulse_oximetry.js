module.exports = {
  title: '💨 Pulse Oximetry',
  columns: ['Date/Time', 'SpO2', 'Heart Rate', 'Room Air/O2', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      SpO2: getValue(entry.spo2 || entry.oxygenSaturation),
      'Heart Rate': getValue(entry.heartRate || entry.pulse),
      'Room Air/O2': getValue(entry.roomAirO2 || entry.oxygenSupport),
      Provider: getValue(entry.provider)
    }));
  }
};
