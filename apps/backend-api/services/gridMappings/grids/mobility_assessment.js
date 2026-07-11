module.exports = {
  title: '🚶 Mobility Assessment',
  columns: ['Date', 'Ambulation', 'Assistive Devices', 'Fall Risk', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Ambulation: getValue(entry.ambulation || entry.mobilityLevel),
      'Assistive Devices': getValue(entry.assistiveDevices || entry.devices),
      'Fall Risk': getValue(entry.fallRisk || entry.riskScore),
      Provider: getValue(entry.provider)
    }));
  }
};
