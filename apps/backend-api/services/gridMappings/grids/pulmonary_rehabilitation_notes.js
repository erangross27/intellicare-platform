module.exports = {
  title: '🫁 Pulmonary Rehabilitation Notes',
  columns: ['Date', 'Exercise Type', 'Duration', 'Progress', 'Therapist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Exercise Type': getValue(entry.exerciseType || entry.type),
      Duration: getValue(entry.duration || entry.time),
      Progress: getValue(entry.progress || entry.assessment),
      Therapist: getValue(entry.therapist || entry.provider)
    }));
  }
};
