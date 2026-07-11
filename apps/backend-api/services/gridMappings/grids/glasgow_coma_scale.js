module.exports = {
  title: '🧠 Glasgow Coma Scale',
  columns: ['Date/Time', 'Eye', 'Verbal', 'Motor', 'Total'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      Eye: getValue(entry.eye || entry.eyeOpening),
      Verbal: getValue(entry.verbal || entry.verbalResponse),
      Motor: getValue(entry.motor || entry.motorResponse),
      Total: getValue(entry.total || entry.gcs)
    }));
  }
};
