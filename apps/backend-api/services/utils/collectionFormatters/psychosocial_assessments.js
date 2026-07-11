/**
 * Psychosocial Assessments Formatter
 * Formats mental health and psychosocial assessments for Claude AI context
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

module.exports = function formatPsychosocialAssessment(doc) {
  const lines = [];

  // Assessment Date
  if (doc.assessmentDate || doc.date) {
    lines.push(`Assessment Date: ${formatDate(doc.assessmentDate || doc.date)}`);
  }

  // Assessor
  if (doc.assessor || doc.provider || doc.assessedBy) {
    lines.push(`Assessor: ${doc.assessor || doc.provider || doc.assessedBy}`);
  }

  // Assessment Type
  if (doc.assessmentType || doc.type) {
    lines.push(`Assessment Type: ${doc.assessmentType || doc.type}`);
  }

  // Presenting Problem/Chief Complaint
  if (doc.presentingProblem || doc.chiefComplaint) {
    lines.push(`\nPresenting Problem: ${doc.presentingProblem || doc.chiefComplaint}`);
  }

  // Mental Status Examination
  if (doc.mentalStatusExam || doc.mse) {
    lines.push(`\nMental Status Examination:`);
    const mse = doc.mentalStatusExam || doc.mse;
    if (typeof mse === 'object') {
      if (mse.appearance) lines.push(`  Appearance: ${mse.appearance}`);
      if (mse.behavior) lines.push(`  Behavior: ${mse.behavior}`);
      if (mse.speech) lines.push(`  Speech: ${mse.speech}`);
      if (mse.mood) lines.push(`  Mood: ${mse.mood}`);
      if (mse.affect) lines.push(`  Affect: ${mse.affect}`);
      if (mse.thoughtProcess) lines.push(`  Thought Process: ${mse.thoughtProcess}`);
      if (mse.thoughtContent) lines.push(`  Thought Content: ${mse.thoughtContent}`);
      if (mse.perception) lines.push(`  Perception: ${mse.perception}`);
      if (mse.cognition) lines.push(`  Cognition: ${mse.cognition}`);
      if (mse.insight) lines.push(`  Insight: ${mse.insight}`);
      if (mse.judgment) lines.push(`  Judgment: ${mse.judgment}`);
    } else {
      lines.push(mse);
    }
  }

  // Mood Assessment
  if (doc.mood) {
    lines.push(`\nMood: ${doc.mood}`);
  }
  if (doc.affect) {
    lines.push(`Affect: ${doc.affect}`);
  }

  // Depression Screening
  if (doc.depressionScreening) {
    lines.push(`\nDepression Screening:`);
    const dep = doc.depressionScreening;
    if (typeof dep === 'object') {
      if (dep.score !== undefined) lines.push(`  Score: ${dep.score}`);
      if (dep.interpretation) lines.push(`  Interpretation: ${dep.interpretation}`);
      if (dep.tool) lines.push(`  Tool Used: ${dep.tool}`);
    } else {
      lines.push(dep);
    }
  }

  // Anxiety Screening
  if (doc.anxietyScreening) {
    lines.push(`\nAnxiety Screening:`);
    const anx = doc.anxietyScreening;
    if (typeof anx === 'object') {
      if (anx.score !== undefined) lines.push(`  Score: ${anx.score}`);
      if (anx.interpretation) lines.push(`  Interpretation: ${anx.interpretation}`);
      if (anx.tool) lines.push(`  Tool Used: ${anx.tool}`);
    } else {
      lines.push(anx);
    }
  }

  // Suicide Risk Assessment
  if (doc.suicideRiskAssessment || doc.suicidalIdeation) {
    lines.push(`\nSuicide Risk Assessment:`);
    const suicide = doc.suicideRiskAssessment || doc.suicidalIdeation;
    if (typeof suicide === 'object') {
      if (suicide.riskLevel) lines.push(`  Risk Level: ${suicide.riskLevel}`);
      if (suicide.ideation !== undefined) lines.push(`  Ideation: ${suicide.ideation}`);
      if (suicide.plan !== undefined) lines.push(`  Plan: ${suicide.plan}`);
      if (suicide.means !== undefined) lines.push(`  Means: ${suicide.means}`);
      if (suicide.intent !== undefined) lines.push(`  Intent: ${suicide.intent}`);
      if (suicide.protectiveFactors) lines.push(`  Protective Factors: ${suicide.protectiveFactors}`);
    } else {
      lines.push(suicide);
    }
  }

  // Substance Use
  if (doc.substanceUse) {
    lines.push(`\nSubstance Use:`);
    const substance = doc.substanceUse;
    if (typeof substance === 'object') {
      if (substance.alcohol) lines.push(`  Alcohol: ${substance.alcohol}`);
      if (substance.tobacco) lines.push(`  Tobacco: ${substance.tobacco}`);
      if (substance.cannabis) lines.push(`  Cannabis: ${substance.cannabis}`);
      if (substance.other) lines.push(`  Other Substances: ${substance.other}`);
    } else {
      lines.push(substance);
    }
  }

  // Social Support
  if (doc.socialSupport) {
    lines.push(`\nSocial Support: ${doc.socialSupport}`);
  }

  // Living Situation
  if (doc.livingSituation || doc.housing) {
    lines.push(`Living Situation: ${doc.livingSituation || doc.housing}`);
  }

  // Employment Status
  if (doc.employmentStatus || doc.employment) {
    lines.push(`Employment: ${doc.employmentStatus || doc.employment}`);
  }

  // Financial Concerns
  if (doc.financialConcerns) {
    lines.push(`Financial Concerns: ${doc.financialConcerns}`);
  }

  // Family Dynamics
  if (doc.familyDynamics || doc.familyRelationships) {
    lines.push(`\nFamily Dynamics: ${doc.familyDynamics || doc.familyRelationships}`);
  }

  // Trauma History
  if (doc.traumaHistory) {
    lines.push(`\nTrauma History: ${doc.traumaHistory}`);
  }

  // Coping Mechanisms
  if (doc.copingMechanisms && Array.isArray(doc.copingMechanisms)) {
    lines.push(`\nCoping Mechanisms: ${doc.copingMechanisms.join(', ')}`);
  } else if (doc.copingMechanisms) {
    lines.push(`\nCoping Mechanisms: ${doc.copingMechanisms}`);
  }

  // Strengths
  if (doc.strengths && Array.isArray(doc.strengths)) {
    lines.push(`\nStrengths: ${doc.strengths.join(', ')}`);
  } else if (doc.strengths) {
    lines.push(`\nStrengths: ${doc.strengths}`);
  }

  // Barriers to Care
  if (doc.barriersToCare && Array.isArray(doc.barriersToCare)) {
    lines.push(`\nBarriers to Care: ${doc.barriersToCare.join(', ')}`);
  } else if (doc.barriersToCare) {
    lines.push(`\nBarriers to Care: ${doc.barriersToCare}`);
  }

  // Goals
  if (doc.goals && Array.isArray(doc.goals)) {
    lines.push(`\nPatient Goals:`);
    doc.goals.forEach((goal, index) => {
      lines.push(`  ${index + 1}. ${goal}`);
    });
  } else if (doc.goals) {
    lines.push(`\nPatient Goals: ${doc.goals}`);
  }

  // Assessment/Impression
  if (doc.assessment || doc.impression || doc.diagnosis) {
    lines.push(`\nAssessment/Diagnosis: ${doc.assessment || doc.impression || doc.diagnosis}`);
  }

  // DSM Diagnosis
  if (doc.dsmDiagnosis && Array.isArray(doc.dsmDiagnosis)) {
    lines.push(`\nDSM Diagnoses:`);
    doc.dsmDiagnosis.forEach((dx, index) => {
      lines.push(`  ${index + 1}. ${dx}`);
    });
  } else if (doc.dsmDiagnosis) {
    lines.push(`\nDSM Diagnosis: ${doc.dsmDiagnosis}`);
  }

  // Treatment Recommendations
  if (doc.treatmentRecommendations && Array.isArray(doc.treatmentRecommendations)) {
    lines.push(`\nTreatment Recommendations:`);
    doc.treatmentRecommendations.forEach((rec, index) => {
      lines.push(`  ${index + 1}. ${rec}`);
    });
  } else if (doc.treatmentRecommendations) {
    lines.push(`\nTreatment Recommendations: ${doc.treatmentRecommendations}`);
  }

  // Referrals
  if (doc.referrals && Array.isArray(doc.referrals)) {
    lines.push(`\nReferrals Made: ${doc.referrals.join(', ')}`);
  } else if (doc.referrals) {
    lines.push(`\nReferrals Made: ${doc.referrals}`);
  }

  // Follow-up Plan
  if (doc.followUpPlan || doc.followUp) {
    lines.push(`\nFollow-up Plan: ${doc.followUpPlan || doc.followUp}`);
  }

  // Safety Plan
  if (doc.safetyPlan) {
    lines.push(`\nSafety Plan: ${doc.safetyPlan}`);
  }

  // Notes
  if (doc.notes || doc.comments) {
    lines.push(`\nNotes: ${doc.notes || doc.comments}`);
  }

  return lines.join('\n');
};
