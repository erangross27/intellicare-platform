module.exports = {
  title: '❤️ Cardiology Admission',
  columns: ['Date', 'Chief Complaint', 'Cardiac Assessment', 'Plan', 'Cardiologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Chief Complaint': getValue(entry.chiefComplaint || entry.complaint),
      'Cardiac Assessment': getValue(entry.cardiacAssessment || entry.assessment),
      Plan: getValue(entry.plan || entry.treatmentPlan),
      Cardiologist: getValue(entry.cardiologist || entry.provider)
    }));
  }
};
