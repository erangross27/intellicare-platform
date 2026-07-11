const getValue = (val, defaultVal = '-') => {
  if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
    return defaultVal;
  }
  const strVal = String(val).trim();
  return strVal || defaultVal;
};

module.exports = {
  title: '📅 Scheduled Appointments',
  columns: ['Date', 'Type', 'Provider', 'Reason', 'Status'],
  mapper: (entry) => ({
    'Date': entry.appointmentDate || entry.date || entry.scheduledDate ?
      new Date(entry.appointmentDate || entry.date || entry.scheduledDate).toLocaleDateString() : '-',
    'Type': getValue(entry.specialty || entry.type || entry.appointmentType, 'General'),
    'Provider': getValue(entry.provider || entry.doctor || entry.providerName || entry.providerId),
    'Reason': getValue(entry.reason || entry.title || entry.description || entry.appointmentReason),
    'Status': getValue(entry.status, 'Scheduled')
  })
};
