module.exports = {
  title: 'Patient Education (AI)',
  columns: ['date', 'category', 'topic', 'content', 'keyPoints', 'resources'],
  headers: ['Date', 'Category', 'Topic', 'Content', 'Key Points', 'Resources'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    const rows = [];

    categoryData.forEach(entry => {
      const date = entry.date ? new Date(entry.date).toLocaleDateString() : '-';

      // Condition Explanation
      if (entry.conditionExplanation) {
        rows.push({
          date, 'category': 'Condition Explanation', 'topic': 'Understanding Your Condition', 'content': getValue(entry.conditionExplanation.simplifiedSummary),
          keyPoints: getValue(entry.conditionExplanation.keyPoints ?
            entry.conditionExplanation.keyPoints.join('; ') : '-'), 'resources': getValue(entry.conditionExplanation.warningSignsToWatch ?
            'Warning signs: ' + entry.conditionExplanation.warningSignsToWatch.join(', ') : '-')
        });

        if (entry.conditionExplanation.whatToExpect) {
          rows.push({
            date, 'category': 'What to Expect', 'topic': 'Your Journey', 'content': getValue(entry.conditionExplanation.whatToExpect),
            keyPoints: '-', 'resources': '-'
          });
        }
      }

      // Medication Instructions
      if (entry.medicationInstructions && Array.isArray(entry.medicationInstructions)) {
        entry.medicationInstructions.forEach(med => {
          rows.push({
            date, 'category': 'Medication', 'topic': getValue(med.medication), 'content': getValue(med.purpose) + ' - ' + getValue(med.howToTake),
            keyPoints: getValue(med.commonSideEffects ?
              'Side effects: ' + med.commonSideEffects.join(', ') : '-'), 'resources': getValue(med.whenToCallDoctor ?
              'Call doctor if: ' + med.whenToCallDoctor.join('; ') : '-')
          });
        });
      }

      // Lifestyle Guidance
      if (entry.lifestyleGuidance && Array.isArray(entry.lifestyleGuidance)) {
        entry.lifestyleGuidance.forEach(guide => {
          rows.push({
            date, 'category': 'Lifestyle', 'topic': getValue(guide.topic), 'content': getValue(guide.recommendation),
            keyPoints: getValue(guide.reasoning), 'resources': getValue(guide.practicalTips ?
              guide.practicalTips.join('; ') : '-')
          });
        });
      }

      // Resources
      if (entry.resources && Array.isArray(entry.resources)) {
        entry.resources.forEach(resource => {
          rows.push({
            date, 'category': 'Resource', 'topic': getValue(resource.type), 'content': getValue(resource.name),
            keyPoints: getValue(resource.purpose), 'resources': getValue(resource.relevance)
          });
        });
      }
    });

    return rows;
  }
};
