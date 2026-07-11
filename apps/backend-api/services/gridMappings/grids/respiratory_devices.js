module.exports = {
  title: '🫁 Respiratory Devices',
  columns: ['Date', 'Device Type', 'Settings', 'Compliance', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Device Type': getValue(entry.deviceType || entry.device),
      Settings: getValue(entry.settings || entry.parameters),
      Compliance: getValue(entry.compliance || entry.adherence),
      Provider: getValue(entry.provider)
    }));
  }
};
