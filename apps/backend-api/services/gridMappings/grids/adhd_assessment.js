module.exports = {
  title: '🧠 ADHD Assessment',
  columns: ['Date', 'Symptoms', 'Rating Scale', 'Diagnosis', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Symptoms: getValue(entry.symptoms || entry.presentation),
      'Rating Scale': getValue(entry.ratingScale || entry.score),
      Diagnosis: getValue(entry.diagnosis || entry.impression),
      Provider: getValue(entry.provider)
    }));
  }
};
