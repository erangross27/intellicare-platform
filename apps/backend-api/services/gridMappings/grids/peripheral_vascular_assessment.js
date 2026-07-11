module.exports = {
  title: '🩺 Peripheral Vascular',
  columns: ['Date', 'Pulses', 'ABI', 'Findings', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Pulses: getValue(entry.pulses || entry.peripheralPulses),
      ABI: getValue(entry.abi || entry.ankleBrachialIndex),
      Findings: getValue(entry.findings || entry.assessment),
      Provider: getValue(entry.provider)
    }));
  }
};
