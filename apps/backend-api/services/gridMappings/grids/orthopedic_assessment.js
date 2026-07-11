module.exports = {
  title: '🦴 Orthopedic Assessment',
  columns: ['Date', 'Joint/Bone', 'Examination', 'Diagnosis', 'Orthopedist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Joint/Bone': getValue(entry.jointBone || entry.location),
      Examination: getValue(entry.examination || entry.exam),
      Diagnosis: getValue(entry.diagnosis || entry.impression),
      Orthopedist: getValue(entry.orthopedist || entry.provider)
    }));
  }
};
