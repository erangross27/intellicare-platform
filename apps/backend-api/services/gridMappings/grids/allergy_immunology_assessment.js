module.exports = {
  title: '🛡️ Allergy & Immunology',
  columns: ['Date', 'Chief Complaint', 'Assessment', 'Treatment', 'Specialist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    return categoryData.map(entry => {
      // Handle both direct fields and extractedData wrapper
      const data = entry.extractedData || entry;

      // Extract chief complaint (handle both string and object formats)
      let chiefComplaint = '-';
      if (data.chiefComplaint) {
        if (typeof data.chiefComplaint === 'object' && data.chiefComplaint.complaint) {
          chiefComplaint = data.chiefComplaint.complaint;
        } else if (typeof data.chiefComplaint === 'string') {
          chiefComplaint = data.chiefComplaint;
        }
      } else if (data.reason) {
        chiefComplaint = data.reason;
      }

      // Extract primary diagnoses (handle array format)
      let assessment = '-';
      if (data.diagnoses && Array.isArray(data.diagnoses) && data.diagnoses.length > 0) {
        const primaryDiagnoses = data.diagnoses
          .filter(d => d.type === 'primary' || !d.type)
          .map(d => {
            const diagnosis = d.diagnosis || d;
            // Remove numbering like "1.", "2." etc and capitalize first word
            const cleaned = diagnosis.replace(/^\d+\.\s*/, '');
            return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
          })
          .slice(0, 3); // Show first 3 diagnoses
        // Join with newline for each diagnosis on its own row
        assessment = primaryDiagnoses.join('\n');
      } else if (data.assessment) {
        assessment = data.assessment;
      } else if (data.diagnosis) {
        assessment = data.diagnosis;
      }

      // Extract treatment plan
      let treatment = '-';
      if (data.treatmentPlan) {
        const treatments = [];
        if (data.treatmentPlan.immediateInterventions) {
          const interventions = data.treatmentPlan.immediateInterventions;
          if (interventions.anaphylaxisPrevention && Array.isArray(interventions.anaphylaxisPrevention)) {
            treatments.push(...interventions.anaphylaxisPrevention.slice(0, 2));
          }
          if (interventions.asthmaOptimization && Array.isArray(interventions.asthmaOptimization)) {
            treatments.push(...interventions.asthmaOptimization.slice(0, 1));
          }
        }
        // Clean and format each treatment
        const formattedTreatments = treatments.map(t => {
          const cleaned = t.replace(/^\d+\.\s*/, '');
          return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        });
        treatment = formattedTreatments.length > 0 ? formattedTreatments.join('\n') : '-';
      } else if (data.treatment) {
        treatment = data.treatment;
      } else if (data.plan) {
        treatment = data.plan;
      }

      // Extract specialist name
      let specialist = '-';
      if (data.consultationDetails && data.consultationDetails.consultingPhysician) {
        specialist = data.consultationDetails.consultingPhysician;
      } else if (data.provider) {
        specialist = data.provider;
      } else if (data.allergist) {
        specialist = data.allergist;
      }

      return {
        Date: data.date ? new Date(data.date).toLocaleDateString() : '-',
        'Chief Complaint': getValue(chiefComplaint),
        Assessment: getValue(assessment),
        Treatment: getValue(treatment),
        Specialist: getValue(specialist)
      };
    });
  }
};
