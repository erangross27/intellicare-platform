module.exports = {
  title: '⚡ Nerve Conduction Study',
  columns: ['Date', 'Nerve', 'Velocity', 'Amplitude', 'Interpretation'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Nerve: getValue(entry.nerve || entry.nerveTested),
      Velocity: getValue(entry.velocity || entry.conductionVelocity),
      Amplitude: getValue(entry.amplitude || entry.responseAmplitude),
      Interpretation: getValue(entry.interpretation || entry.findings)
    }));
  }
};
