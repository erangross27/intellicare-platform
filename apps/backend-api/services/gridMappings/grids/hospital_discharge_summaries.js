module.exports = {
  title: '📄 Hospital Discharge Summary',
  columns: ['Admission Date', 'Discharge Date', 'Diagnosis', 'Hospital Course Summary', 'Condition at Discharge', 'Disposition'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    return categoryData.map(entry => {
      // Data is nested in extractedData object for discharge summaries
      const data = entry.extractedData || entry;
      const adminData = data.administrativeData || {};
      const hospitalCourse = data.hospitalCourse || {};

      // Get primary diagnosis
      let primaryDiagnosis = '-';
      if (data.diagnoses && Array.isArray(data.diagnoses) && data.diagnoses.length > 0) {
        const primary = data.diagnoses.find(d => d.type === 'primary');
        primaryDiagnosis = primary ? getValue(primary.diagnosis) : getValue(data.diagnoses[0].diagnosis);
      } else if (adminData.admittingDiagnosis) {
        primaryDiagnosis = getValue(adminData.admittingDiagnosis);
      }

      const admissionDate = hospitalCourse.admissionDate || adminData.admissionDate;
      const dischargeDate = hospitalCourse.dischargeDate || adminData.dischargeDate;
      const disposition = hospitalCourse.disposition || adminData.disposition;
      const condition = hospitalCourse.condition || adminData.conditionAtDischarge;

      // Get hospital course narrative
      const courseSummary = getValue(hospitalCourse.hospitalCourse || data.historyOfPresentIllness);

      return {
        'Admission Date': admissionDate ? new Date(admissionDate).toLocaleDateString() : '-',
        'Discharge Date': dischargeDate ? new Date(dischargeDate).toLocaleDateString() : '-',
        Diagnosis: primaryDiagnosis,
        'Hospital Course Summary': courseSummary,
        'Condition at Discharge': getValue(condition),
        Disposition: getValue(disposition)
      };
    });
  }
};
