module.exports = {
  title: '🏥 Hospital Course',
  columns: ['Date', 'Admission', 'Discharge', 'Length of Stay', 'Outcome'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => {
      // Data may be nested in entry.course object
      const course = entry.course || entry;

      const admissionDate = course.admissionDate || entry.admissionDate;
      const dischargeDate = course.dischargeDate || entry.dischargeDate;
      const lengthOfStay = course.lengthOfStay || entry.lengthOfStay || entry.los;
      const condition = course.condition || entry.condition;
      const disposition = course.disposition || entry.disposition || entry.dischargeTo;
      const admittingDiagnosis = course.admittingDiagnosis || entry.admittingDiagnosis || entry.admissionReason || entry.chiefComplaint;

      // Format outcome to show both condition and disposition
      let outcome = '-';
      if (condition && disposition) {
        outcome = `${getValue(condition)} - ${getValue(disposition)}`;
      } else if (condition) {
        outcome = getValue(condition);
      } else if (disposition) {
        outcome = getValue(disposition);
      }

      return {
        Date: entry.date ? new Date(entry.date).toLocaleDateString() : (admissionDate ? new Date(admissionDate).toLocaleDateString() : '-'),
        Admission: admissionDate ? new Date(admissionDate).toLocaleDateString() : '-',
        Discharge: dischargeDate ? new Date(dischargeDate).toLocaleDateString() : '-',
        'Length of Stay': lengthOfStay ? `${lengthOfStay} days` : '-',
        Outcome: outcome
      };
    });
  }
};
