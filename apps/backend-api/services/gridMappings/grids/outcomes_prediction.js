module.exports = {
  title: '📊 Outcomes Prediction (AI)',
  columns: ['Date', 'Overall Prognosis', 'Risk Factor', 'Potential Benefit', 'Recommendation'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    const extractPrognosisSummary = (fullPrognosis) => {
      // Extract just the first sentence (summary)
      const text = getValue(fullPrognosis);
      const firstSentence = text.split('.')[0] + '.';
      return firstSentence;
    };

    const rows = [];

    categoryData.forEach(entry => {
      const date = entry.date ? new Date(entry.date).toLocaleDateString() : '-';
      const prognosisSummary = extractPrognosisSummary(entry.prognosis);

      if (entry.modifiableFactors && Array.isArray(entry.modifiableFactors)) {
        entry.modifiableFactors.forEach((factorObj, index) => {
          // Handle both string format and object format
          let factorText, impactText, recommendationText;

          if (typeof factorObj === 'string') {
            factorText = factorObj;
            impactText = '-';
            recommendationText = getValue(entry.expectedOutcomes);
          } else {
            factorText = getValue(factorObj.factor);

            // Check if recommendation is a separate field (new schema)
            if (factorObj.recommendation) {
              // New format: impact and recommendation are separate
              impactText = getValue(factorObj.impact);
              recommendationText = getValue(factorObj.recommendation);
            } else {
              // Old format: recommendation is mixed into impact field
              // Split by period to separate benefit from recommendation
              const fullImpact = getValue(factorObj.impact);
              const sentences = fullImpact.split(/\.\s+/);

              // First sentence is the benefit/impact
              impactText = sentences[0] + '.';

              // Remaining sentences are the recommendation
              if (sentences.length > 1) {
                recommendationText = sentences.slice(1).join('. ').trim();
                // Ensure it ends with a period if it has content
                if (recommendationText && !recommendationText.endsWith('.')) {
                  recommendationText += '.';
                }
              } else {
                recommendationText = '-';
              }
            }
          }

          rows.push({
            'Date': date,
            'Overall Prognosis': prognosisSummary,  // Show on every row for context
            'Risk Factor': factorText,
            'Potential Benefit': impactText,
            'Recommendation': recommendationText
          });
        });
      } else {
        // Single row if no modifiable factors array
        rows.push({
          'Date': date,
          'Overall Prognosis': prognosisSummary,
          'Risk Factor': '-',
          'Potential Benefit': '-',
          'Recommendation': getValue(entry.expectedOutcomes)
        });
      }
    });

    return rows;
  }
};
