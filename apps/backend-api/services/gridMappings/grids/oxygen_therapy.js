module.exports = {
  title: '💨 Oxygen Therapy',
  columns: ['Date/Time', 'Device', 'Flow Rate', 'SpO2', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      Device: getValue(entry.device || entry.deliveryMethod),
      'Flow Rate': getValue(entry.flowRate || entry.litersPerMinute),
      SpO2: getValue(entry.spo2 || entry.oxygenSaturation),
      Provider: getValue(entry.provider)
    }));
  }
};
