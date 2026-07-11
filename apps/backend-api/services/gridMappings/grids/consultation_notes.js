module.exports = {
  title: '👨‍⚕️ Consultation Notes',
  columns: ['Date', 'Specialty', 'Consultant', 'Recommendations', 'Follow-up'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Specialty: getValue(entry.specialty || entry.consultingSpecialty),
      Consultant: getValue(entry.consultant || entry.provider),
      Recommendations: getValue(entry.recommendations || entry.plan),
      'Follow-up': getValue(entry.followUp || entry.nextSteps)
    }));
  }
};
