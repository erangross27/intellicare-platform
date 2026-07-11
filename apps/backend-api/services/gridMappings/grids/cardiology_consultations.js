module.exports = {
  title: '❤️ Cardiology',
  columns: ['Date', 'Section', 'Details', 'Cardiologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    const rows = [];

    categoryData.forEach(entry => {
      const data = entry.extractedData || entry;
      const date = entry.date ? new Date(entry.date).toLocaleDateString() : '-';

      // Extract cardiologist
      let cardiologist = '-';
      if (data.consultationDetails && data.consultationDetails.consultingPhysician) {
        cardiologist = getValue(data.consultationDetails.consultingPhysician);
      } else {
        cardiologist = getValue(data.provider || data.cardiologist || data.consultingPhysician);
      }

      const fullText = data.assessmentAndPlan || data.plan || data.recommendations;
      if (fullText) {
        const text = String(fullText).trim();
        const treatmentPlanIndex = text.indexOf('TREATMENT PLAN:');

        if (treatmentPlanIndex > 0) {
          // Assessment sections
          const assessmentText = text.substring(0, treatmentPlanIndex).trim();

          // Split assessment into sections
          const primaryDx = assessmentText.match(/PRIMARY DIAGNOSIS:(.*?)(?=STROKE|$)/s);
          if (primaryDx) {
            rows.push({
              'Date': date,
              'Section': 'Primary Diagnosis',
              'Details': primaryDx[1].trim(),
              'Cardiologist': cardiologist
            });
          }

          const strokeRisk = assessmentText.match(/STROKE RISK ASSESSMENT:(.*?)(?=BLEEDING|$)/s);
          if (strokeRisk) {
            rows.push({
              'Date': date,
              'Section': 'Stroke Risk',
              'Details': strokeRisk[1].trim(),
              'Cardiologist': cardiologist
            });
          }

          const bleedingRisk = assessmentText.match(/BLEEDING RISK ASSESSMENT:(.*?)$/s);
          if (bleedingRisk) {
            rows.push({
              'Date': date,
              'Section': 'Bleeding Risk',
              'Details': bleedingRisk[1].trim(),
              'Cardiologist': cardiologist
            });
          }

          // Treatment plan sections
          const planText = text.substring(treatmentPlanIndex).trim();

          // Extract numbered sections - matches any capital letter pattern
          const sections = planText.split(/(?=\d+\.\s+)/);
          sections.forEach(section => {
            // Match: "1. ANY CAPS TEXT:" or "1. MixedCase:" or "1. A:"
            const match = section.match(/\d+\.\s+([A-Z][A-Z\s\-\/&]*?):(.*)/s);
            if (match) {
              // Convert any capital letter format to Title Case
              const rawSection = match[1].trim();
              const sectionName = rawSection
                .toLowerCase()
                .split(/\s+/)
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');

              rows.push({
                'Date': date,
                'Section': sectionName,
                'Details': match[2].trim(),
                'Cardiologist': cardiologist
              });
            }
          });
        }
      }
    });

    return rows;
  }
};
