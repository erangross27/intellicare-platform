/**
 * Guideline Compliance Formatter
 * Formats clinical guideline compliance assessments
 */

function formatDate(dateValue) {
  if (!dateValue) return 'Unknown date';
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (err) {
    return 'Unknown date';
  }
}

module.exports = function formatGuidelineCompliance(doc) {
  const lines = [];

  // Assessment Date
  if (doc.assessmentDate || doc.date) {
    lines.push(`Assessment Date: ${formatDate(doc.assessmentDate || doc.date)}`);
  }

  // Overall Compliance Score
  if (doc.overallComplianceScore !== undefined) {
    lines.push(`Overall Compliance Score: ${doc.overallComplianceScore}%`);
  }

  // Compliance Status
  if (doc.complianceStatus) {
    lines.push(`Compliance Status: ${doc.complianceStatus}`);
  }

  // Guidelines Assessed
  if (doc.guidelinesAssessed && Array.isArray(doc.guidelinesAssessed)) {
    lines.push(`\nGuidelines Assessed (${doc.guidelinesAssessed.length}):`);

    doc.guidelinesAssessed.forEach((guideline, index) => {
      if (typeof guideline === 'object') {
        lines.push(`\n${index + 1}. ${guideline.guidelineName || guideline.name}`);

        if (guideline.organization) {
          lines.push(`   Organization: ${guideline.organization}`);
        }
        if (guideline.version) {
          lines.push(`   Version: ${guideline.version}`);
        }
        if (guideline.complianceScore !== undefined) {
          lines.push(`   Compliance Score: ${guideline.complianceScore}%`);
        }
        if (guideline.status) {
          lines.push(`   Status: ${guideline.status}`);
        }
        if (guideline.lastUpdated) {
          lines.push(`   Last Updated: ${formatDate(guideline.lastUpdated)}`);
        }
      } else {
        lines.push(`${index + 1}. ${guideline}`);
      }
    });
  }

  // Compliant Items
  if (doc.compliantItems && Array.isArray(doc.compliantItems)) {
    lines.push(`\nCompliant Items (${doc.compliantItems.length}):`);
    doc.compliantItems.forEach((item, index) => {
      lines.push(`${index + 1}. ${typeof item === 'object' ? item.item || item.recommendation : item}`);
    });
  }

  // Non-Compliant Items
  if (doc.nonCompliantItems && Array.isArray(doc.nonCompliantItems)) {
    lines.push(`\nNon-Compliant Items (${doc.nonCompliantItems.length}):`);
    doc.nonCompliantItems.forEach((item, index) => {
      if (typeof item === 'object') {
        lines.push(`${index + 1}. ${item.item || item.recommendation}`);
        if (item.reason) {
          lines.push(`   Reason: ${item.reason}`);
        }
        if (item.recommendedAction) {
          lines.push(`   Recommended Action: ${item.recommendedAction}`);
        }
        if (item.priority) {
          lines.push(`   Priority: ${item.priority}`);
        }
      } else {
        lines.push(`${index + 1}. ${item}`);
      }
    });
  }

  // Care Gaps
  if (doc.careGaps && Array.isArray(doc.careGaps)) {
    lines.push(`\nIdentified Care Gaps (${doc.careGaps.length}):`);
    doc.careGaps.forEach((gap, index) => {
      if (typeof gap === 'object') {
        lines.push(`${index + 1}. ${gap.gap || gap.description}`);
        if (gap.impact) {
          lines.push(`   Impact: ${gap.impact}`);
        }
        if (gap.recommendation) {
          lines.push(`   Recommendation: ${gap.recommendation}`);
        }
        if (gap.priority) {
          lines.push(`   Priority: ${gap.priority}`);
        }
      } else {
        lines.push(`${index + 1}. ${gap}`);
      }
    });
  }

  // Quality Measures
  if (doc.qualityMeasures) {
    lines.push(`\nQuality Measures:`);
    Object.entries(doc.qualityMeasures).forEach(([measure, value]) => {
      lines.push(`   ${measure}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
    });
  }

  // Performance Metrics
  if (doc.performanceMetrics) {
    lines.push(`\nPerformance Metrics:`);
    Object.entries(doc.performanceMetrics).forEach(([metric, value]) => {
      lines.push(`   ${metric}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
    });
  }

  // Recommendations for Improvement
  if (doc.improvementRecommendations && Array.isArray(doc.improvementRecommendations)) {
    lines.push(`\nRecommendations for Improvement:`);
    doc.improvementRecommendations.forEach((rec, index) => {
      if (typeof rec === 'object') {
        lines.push(`${index + 1}. ${rec.recommendation}`);
        if (rec.expectedImpact) {
          lines.push(`   Expected Impact: ${rec.expectedImpact}`);
        }
        if (rec.timeframe) {
          lines.push(`   Timeframe: ${rec.timeframe}`);
        }
      } else {
        lines.push(`${index + 1}. ${rec}`);
      }
    });
  }

  // Documentation Gaps
  if (doc.documentationGaps && Array.isArray(doc.documentationGaps)) {
    lines.push(`\nDocumentation Gaps: ${doc.documentationGaps.join(', ')}`);
  }

  // Next Review Date
  if (doc.nextReviewDate) {
    lines.push(`\nNext Review Date: ${formatDate(doc.nextReviewDate)}`);
  }

  // Source Document
  if (doc.documentId) {
    lines.push(`\nSource Document ID: ${doc.documentId}`);
  }

  // Assessor
  if (doc.assessedBy) {
    lines.push(`Assessed By: ${doc.assessedBy}`);
  }

  return lines.join('\n');
};
