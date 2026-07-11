module.exports = {
  title: '🧠 Neurological Exam',
  columns: ['Date', 'Mental Status', 'Cranial Nerves', 'Motor/Sensory', 'Neurologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Mental Status': getValue(entry.mentalStatus || entry.cognition),
      'Cranial Nerves': getValue(entry.cranialNerves || entry.cn),
      'Motor/Sensory': getValue(entry.motorSensory || entry.motorSensoryExam),
      Neurologist: getValue(entry.neurologist || entry.provider)
    }));
  }
};
