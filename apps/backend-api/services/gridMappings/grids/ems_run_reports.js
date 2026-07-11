module.exports = {
  title: '🚑 EMS Run Reports',
  columns: ['Date/Time', 'Chief Complaint', 'Vitals', 'Treatment', 'Paramedic'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.dateTime || entry.date ? new Date(entry.dateTime || entry.date).toLocaleString() : '-',
      'Chief Complaint': getValue(entry.chiefComplaint || entry.complaint),
      Vitals: getValue(entry.vitals || entry.vitalSigns),
      Treatment: getValue(entry.treatment || entry.interventions),
      Paramedic: getValue(entry.paramedic || entry.provider)
    }));
  }
};
