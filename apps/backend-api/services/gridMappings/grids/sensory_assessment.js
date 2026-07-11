module.exports = {
  title: '👂 Sensory Assessment',
  columns: ['Date', 'Modality', 'Left', 'Right', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Modality: getValue(entry.modality || entry.sensoryType),
      Left: getValue(entry.left || entry.leftSide),
      Right: getValue(entry.right || entry.rightSide),
      Provider: getValue(entry.provider)
    }));
  }
};
