module.exports = {
  title: '🦷 Orthodontic Treatment Plans',
  columns: ['Date', 'Diagnosis', 'Treatment', 'Duration', 'Orthodontist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Diagnosis: getValue(entry.diagnosis || entry.malocclusion),
      Treatment: getValue(entry.treatment || entry.plan),
      Duration: getValue(entry.duration || entry.estimatedTime),
      Orthodontist: getValue(entry.orthodontist || entry.provider)
    }));
  }
};
