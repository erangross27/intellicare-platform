module.exports = {
  title: '🧠 Neurological Assessment',
  columns: ['Date', 'Mental Status', 'Cranial Nerves', 'Motor/Sensory', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Mental Status': getValue(entry.mentalStatus || entry.consciousness),
      'Cranial Nerves': getValue(entry.cranialNerves || entry.cnExam),
      'Motor/Sensory': getValue(entry.motorSensory || entry.neuroExam),
      Provider: getValue(entry.provider)
    }));
  }
};
