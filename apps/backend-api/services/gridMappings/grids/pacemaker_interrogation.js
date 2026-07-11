module.exports = {
  title: '⚡ Pacemaker Interrogation',
  columns: ['Date', 'Battery Status', 'Lead Function', 'Settings', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Battery Status': getValue(entry.batteryStatus || entry.battery),
      'Lead Function': getValue(entry.leadFunction || entry.leadIntegrity),
      Settings: getValue(entry.settings || entry.parameters),
      Provider: getValue(entry.provider)
    }));
  }
};
