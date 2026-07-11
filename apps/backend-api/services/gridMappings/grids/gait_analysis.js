module.exports = {
  title: '🚶 Gait Analysis',
  columns: ['Date', 'Gait Pattern', 'Speed', 'Balance', 'Assistive Device'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Gait Pattern': getValue(entry.gaitPattern || entry.pattern),
      Speed: getValue(entry.speed || entry.walkingSpeed),
      Balance: getValue(entry.balance || entry.stability),
      'Assistive Device': getValue(entry.assistiveDevice || entry.device, 'None')
    }));
  }
};
