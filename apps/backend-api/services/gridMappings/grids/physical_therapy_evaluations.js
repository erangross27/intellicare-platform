module.exports = {
  title: '🏃 Physical Therapy',
  columns: ['Date', 'Chief Complaint', 'Assessment', 'Goals', 'Therapist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Chief Complaint': getValue(entry.chiefComplaint || entry.reason),
      Assessment: getValue(entry.assessment || entry.findings),
      Goals: getValue(entry.goals || entry.plan),
      Therapist: getValue(entry.therapist || entry.provider)
    }));
  }
};
