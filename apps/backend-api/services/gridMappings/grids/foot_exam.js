module.exports = {
  title: '🦶 Foot Examination',
  columns: ['Date', 'Pulses', 'Sensation', 'Skin Integrity', 'Findings'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Pulses: getValue(entry.pulses || entry.pedalPulses || entry['pedal Pulses']),
      Sensation: getValue(entry.sensation || entry.monofilament),
      'Skin Integrity': getValue(entry.skinIntegrity || entry.skin),
      Findings: getValue(entry.findings || entry.abnormalities, 'Normal')
    }));
  }
};
