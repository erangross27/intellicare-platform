module.exports = {
  title: '💓 Cardiac Monitoring',
  columns: ['Date/Time', 'Rhythm', 'Rate', 'ST Changes', 'Alarms'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      Rhythm: getValue(entry.rhythm || entry.cardiacRhythm),
      Rate: getValue(entry.rate || entry.heartRate),
      'ST Changes': getValue(entry.stChanges || entry.stSegment, 'None'),
      Alarms: getValue(entry.alarms || entry.alerts, 'None')
    }));
  }
};
