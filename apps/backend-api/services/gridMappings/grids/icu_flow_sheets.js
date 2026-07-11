module.exports = {
  title: '🩺 ICU Flow Sheet',
  columns: ['Date/Time', 'Vitals', 'I/O', 'Ventilator', 'Meds'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      Vitals: getValue(entry.bloodPressure || entry.vitals) + (entry.heartRate ? ` / ${entry.heartRate}` : ''),
      'I/O': getValue(entry.fluidIntake) + (entry.fluidOutput ? ` / ${entry.fluidOutput}` : ''),
      Ventilator: getValue(entry.ventilatorMode || entry.ventilatorSettings),
      Meds: getValue(entry.medications || entry.infusions)
    }));
  }
};
