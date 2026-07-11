module.exports = {
  title: '🦵 Lower Extremity Exam',
  columns: ['Date', 'Side', 'Pulses', 'Sensation', 'Strength'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Side: getValue(entry.side || entry.laterality),
      Pulses: getValue(entry.pulses || entry.peripheralPulses),
      Sensation: getValue(entry.sensation || entry.sensoryExam),
      Strength: getValue(entry.strength || entry.motorStrength)
    }));
  }
};
