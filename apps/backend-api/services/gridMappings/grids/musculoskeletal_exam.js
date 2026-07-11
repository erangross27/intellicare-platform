module.exports = {
  title: '🦴 Musculoskeletal Exam',
  columns: ['Date', 'Area', 'Range of Motion', 'Tenderness', 'Swelling'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Area: getValue(entry.area || entry.location),
      'Range of Motion': getValue(entry.rangeOfMotion || entry.rom),
      Tenderness: getValue(entry.tenderness || entry.pain),
      Swelling: getValue(entry.swelling || entry.edema)
    }));
  }
};
