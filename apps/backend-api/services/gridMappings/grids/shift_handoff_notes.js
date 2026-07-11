module.exports = {
  title: '🔄 Shift Handoff Notes',
  columns: ['Date', 'Shift', 'Key Events', 'Concerns', 'Nurse'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Shift: getValue(entry.shift || entry.shiftTime),
      'Key Events': getValue(entry.keyEvents || entry.events),
      Concerns: getValue(entry.concerns || entry.issues),
      Nurse: getValue(entry.nurse || entry.provider)
    }));
  }
};
