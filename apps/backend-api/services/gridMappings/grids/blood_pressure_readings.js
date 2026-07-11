module.exports = {
  title: '💓 Blood Pressure Readings',
  columns: ['Date/Time', 'Systolic', 'Diastolic', 'MAP', 'Position'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      Systolic: getValue(entry.systolic || entry.sys),
      Diastolic: getValue(entry.diastolic || entry.dias),
      MAP: getValue(entry.map || entry.meanArterialPressure),
      Position: getValue(entry.position || entry.posture, 'Sitting')
    }));
  }
};
