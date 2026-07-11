module.exports = {
  title: '🚫 Omissions & Refusals',
  columns: ['Date/Time', 'Medication', 'Reason', 'Provider Notified', 'Nurse'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.dateTime || entry.date ? new Date(entry.dateTime || entry.date).toLocaleString() : '-',
      Medication: getValue(entry.medication || entry.drug),
      Reason: getValue(entry.reason || entry.explanation),
      'Provider Notified': getValue(entry.providerNotified || entry.notification),
      Nurse: getValue(entry.nurse || entry.provider)
    }));
  }
};
