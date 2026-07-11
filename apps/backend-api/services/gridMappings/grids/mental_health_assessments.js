module.exports = {
  title: '🧘 Mental Health',
  columns: ['Date', 'Chief Complaint', 'Diagnosis', 'Treatment Plan', 'Psychiatrist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Chief Complaint': getValue(entry.chiefComplaint || entry.reason || entry.presentingProblem),
      Diagnosis: getValue(entry.diagnosis || entry.assessment),
      'Treatment Plan': getValue(entry.plan || entry.treatment || entry.recommendations),
      Psychiatrist: getValue(entry.provider || entry.psychiatrist || entry.therapist)
    }));
  }
};
