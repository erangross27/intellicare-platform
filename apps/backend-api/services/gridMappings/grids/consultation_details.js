module.exports = {
  title: '👨‍⚕️ Consultation Details',
  columns: ['Date', 'Specialty', 'Provider', 'Reason', 'Recommendation'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Specialty: getValue(entry.consultingSpecialty || entry.specialty || entry.department),
      Provider: getValue(entry.consultingPhysician || entry.provider || entry.consultant),
      Reason: getValue(entry.reasonForConsult || entry.reason || entry.indication),
      Recommendation: getValue(entry.recommendations || entry.recommendation || entry.plan)
    }));
  }
};
