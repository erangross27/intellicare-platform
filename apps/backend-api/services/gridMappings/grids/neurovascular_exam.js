module.exports = {
  title: '🔍 Neurovascular Exam',
  columns: ['Date', 'Sensation', 'Motor', 'Pulses', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Sensation: getValue(entry.sensation || entry.sensory),
      Motor: getValue(entry.motor || entry.motorFunction),
      Pulses: getValue(entry.pulses || entry.vascular),
      Provider: getValue(entry.provider)
    }));
  }
};
