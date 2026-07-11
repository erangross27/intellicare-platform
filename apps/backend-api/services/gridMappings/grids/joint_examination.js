module.exports = {
  title: '🦴 Joint Examination',
  columns: ['Date', 'Joint', 'Range of Motion', 'Swelling', 'Tenderness'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Joint: getValue(entry.joint || entry.location),
      'Range of Motion': getValue(entry.rangeOfMotion || entry.rom),
      Swelling: getValue(entry.swelling || entry.effusion),
      Tenderness: getValue(entry.tenderness || entry.pain)
    }));
  }
};
