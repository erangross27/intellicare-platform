module.exports = {
  title: '👩‍⚕️ Nursing Assessment',
  columns: ['Date/Time', 'Vital Signs', 'Pain Level', 'Assessment', 'Nurse'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      'Vital Signs': getValue(entry.vitalSigns || entry.vitals),
      'Pain Level': getValue(entry.painLevel || entry.pain),
      Assessment: getValue(entry.assessment || entry.findings),
      Nurse: getValue(entry.nurse || entry.provider)
    }));
  }
};
