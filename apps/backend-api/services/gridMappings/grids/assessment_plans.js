module.exports = {
  title: '📝 Assessment & Plans',
  columns: ['Date', 'Section', 'Details', 'Provider'],
  mapper: (categoryData) => {
    const rows = [];

    categoryData.forEach(entry => {
      const date = entry.date ? new Date(entry.date).toLocaleDateString() : (entry.visitDate ? new Date(entry.visitDate).toLocaleDateString() : '-');
      const provider = entry.provider || entry.physician || 'Clinical Team';

      const fullText = entry.assessment || entry.plan || entry.assessmentAndPlan || '-';

      if (fullText && fullText !== '-') {
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
              'Provider': provider
            });
          }

          const strokeRisk = assessmentText.match(/STROKE RISK ASSESSMENT:(.*?)(?=BLEEDING|$)/s);
          if (strokeRisk) {
            rows.push({
              'Date': date,
              'Section': 'Stroke Risk',
              'Details': strokeRisk[1].trim(),
              'Provider': provider
            });
          }

          const bleedingRisk = assessmentText.match(/BLEEDING RISK ASSESSMENT:(.*?)$/s);
          if (bleedingRisk) {
            rows.push({
              'Date': date,
              'Section': 'Bleeding Risk',
              'Details': bleedingRisk[1].trim(),
              'Provider': provider
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
                'Provider': provider
              });
            }
          });
        } else {
          // Fallback if no structured format - parse numbered diagnoses
          // Check if this contains "Primary Diagnoses:" with numbered list
          if (text.includes('Primary Diagnoses:') || text.match(/\d+\.\s+/)) {
            // Extract numbered items (1. ... 2. ... 3. ...)
            const numberPattern = /(\d+)\.\s+([^,\d]+(?:,(?!\s*\d+\.)[^,\d]+)*)/g;
            const items = [];
            let match;

            while ((match = numberPattern.exec(text)) !== null) {
              const item = match[2].trim();
              // Remove trailing punctuation and clean up
              const cleaned = item.replace(/[,;.]$/, '').trim();
              // Capitalize first letter
              const formatted = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
              items.push(formatted);
            }

            if (items.length > 0) {
              // Create a separate row for each diagnosis
              items.forEach((diagnosis, index) => {
                rows.push({
                  'Date': date,
                  'Section': `Diagnosis ${index + 1}`,
                  'Details': diagnosis,
                  'Provider': provider
                });
              });
              return; // Skip the default row below
            }
          }

          // If no numbered items found, create single row with full text
          rows.push({
            'Date': date,
            'Section': 'Assessment & Plan',
            'Details': text,
            'Provider': provider
          });
        }
      }
    });

    return rows;
  }
};
