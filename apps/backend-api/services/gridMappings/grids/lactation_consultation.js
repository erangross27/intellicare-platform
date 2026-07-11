module.exports = {
  title: '🤱 Lactation Consultation',
  columns: ['Date', 'Issue', 'Intervention', 'Feeding Assessment', 'Consultant'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Issue: getValue(entry.issue || entry.concern),
      Intervention: getValue(entry.intervention || entry.recommendation),
      'Feeding Assessment': getValue(entry.feedingAssessment || entry.latchScore),
      Consultant: getValue(entry.consultant || entry.provider)
    }));
  }
};
