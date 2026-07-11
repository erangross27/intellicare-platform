module.exports = {
  title: '📅 Follow-up Enhanced',
  columns: ['Date', 'Appointment Type', 'Reason', 'Notes', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Appointment Type': getValue(entry.appointmentType || entry.type),
      Reason: getValue(entry.reason || entry.indication),
      Notes: getValue(entry.notes || entry.comments),
      Provider: getValue(entry.provider)
    }));
  }
};
