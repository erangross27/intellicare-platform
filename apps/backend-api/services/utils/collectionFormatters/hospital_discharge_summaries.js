/**
 * Hospital Discharge Summaries Formatter
 *
 * Formats unified hospital discharge documents for Claude AI context
 * Presents ALL medical data in organized, readable format
 */

module.exports = function formatHospitalDischargeSummaries(doc) {
  const lines = [];

  // Patient Demographics
  lines.push('=== PATIENT DEMOGRAPHICS ===');
  if (doc.patientName) lines.push(`Name: ${doc.patientName}`);
  if (doc.dateOfBirth) lines.push(`DOB: ${doc.dateOfBirth}`);
  if (doc.age) lines.push(`Age: ${doc.age}`);
  if (doc.gender) lines.push(`Gender: ${doc.gender}`);
  if (doc.race) lines.push(`Race: ${doc.race}`);
  if (doc.ethnicity) lines.push(`Ethnicity: ${doc.ethnicity}`);
  if (doc.mrn || doc.patientId) lines.push(`MRN: ${doc.mrn || doc.patientId}`);
  if (doc.date || doc.documentDate) lines.push(`Document Date: ${doc.date || doc.documentDate}`);
  lines.push('');

  // Administrative Data
  if (doc.administrativeData) {
    lines.push('=== ADMINISTRATIVE INFORMATION ===');
    const admin = doc.administrativeData;
    if (admin.admissionDate) lines.push(`Admission Date: ${admin.admissionDate}`);
    if (admin.dischargeDate) lines.push(`Discharge Date: ${admin.dischargeDate}`);
    if (admin.lengthOfStay) lines.push(`Length of Stay: ${admin.lengthOfStay}`);
    if (admin.admittingDiagnosis) lines.push(`Admitting Diagnosis: ${admin.admittingDiagnosis}`);
    if (admin.conditionAtDischarge) lines.push(`Condition at Discharge: ${admin.conditionAtDischarge}`);
    if (admin.disposition) lines.push(`Disposition: ${admin.disposition}`);
    if (admin.dietaryInstructions) lines.push(`Diet: ${admin.dietaryInstructions}`);
    if (admin.electronicSignature) lines.push(`Signed By: ${admin.electronicSignature}`);
    lines.push('');
  }

  // Providers
  if (doc.providers) {
    lines.push('=== CARE TEAM PROVIDERS ===');
    if (doc.providers.primary) lines.push(`Primary Provider: ${doc.providers.primary}`);
    if (doc.providers.consulting && doc.providers.consulting.length > 0) {
      lines.push('\nConsulting Providers:');
      doc.providers.consulting.forEach((provider, idx) => {
        const specialty = doc.providers.consultingSpecialties && doc.providers.consultingSpecialties[idx]
          ? ` - ${doc.providers.consultingSpecialties[idx]}`
          : '';
        lines.push(`  ${idx + 1}. ${provider}${specialty}`);
      });
    }
    lines.push('');
  }

  // Diagnoses
  if (doc.diagnoses && doc.diagnoses.length > 0) {
    lines.push('=== DIAGNOSES ===');
    doc.diagnoses.forEach((dx, idx) => {
      const diagnosis = dx.diagnosis || dx.condition;
      const type = dx.type ? ` (${dx.type})` : '';
      const status = dx.status ? ` - ${dx.status}` : '';
      lines.push(`${idx + 1}. ${diagnosis}${type}${status}`);
    });
    lines.push('');
  }

  // History of Present Illness
  if (doc.historyOfPresentIllness) {
    lines.push('=== HISTORY OF PRESENT ILLNESS ===');
    lines.push(doc.historyOfPresentIllness);
    lines.push('');
  }

  // Hospital Course
  if (doc.hospitalCourse) {
    lines.push('=== HOSPITAL COURSE ===');
    lines.push(doc.hospitalCourse);
    lines.push('');
  }

  // Treatment Course
  if (doc.treatmentCourse) {
    lines.push('=== TREATMENT COURSE ===');

    if (doc.treatmentCourse.ivMedications && doc.treatmentCourse.ivMedications.length > 0) {
      lines.push('\nIV Medications:');
      doc.treatmentCourse.ivMedications.forEach(med => {
        let medLine = `  • ${med.medication}`;
        if (med.dose) medLine += ` ${med.dose}`;
        if (med.route) medLine += ` ${med.route}`;
        if (med.frequency) medLine += ` ${med.frequency}`;
        if (med.duration) medLine += ` - ${med.duration}`;
        lines.push(medLine);
      });
    }

    if (doc.treatmentCourse.nebulizers && doc.treatmentCourse.nebulizers.length > 0) {
      lines.push('\nNebulizer Treatments:');
      doc.treatmentCourse.nebulizers.forEach(neb => {
        lines.push(`  • ${neb.medication} ${neb.frequency || ''}`);
      });
    }

    if (doc.treatmentCourse.oralMedications && doc.treatmentCourse.oralMedications.length > 0) {
      lines.push('\nOral Medications:');
      doc.treatmentCourse.oralMedications.forEach(med => {
        let medLine = `  • ${med.medication}`;
        if (med.dose) medLine += ` ${med.dose}`;
        if (med.route) medLine += ` ${med.route}`;
        if (med.frequency) medLine += ` ${med.frequency}`;
        if (med.duration) medLine += ` - ${med.duration}`;
        lines.push(medLine);
      });
    }

    if (doc.treatmentCourse.oxygenTherapy) {
      lines.push('\nOxygen Therapy:');
      const oxy = doc.treatmentCourse.oxygenTherapy;
      if (oxy.method) lines.push(`  Method: ${oxy.method}`);
      if (oxy.targetSaturation) lines.push(`  Target: ${oxy.targetSaturation}`);
    }
    lines.push('');
  }

  // Procedures
  if (doc.procedures && doc.procedures.length > 0) {
    lines.push('=== PROCEDURES ===');
    doc.procedures.forEach((proc, idx) => {
      lines.push(`\n${idx + 1}. ${proc.name || proc.procedureName}`);
      if (proc.date) lines.push(`   Date: ${proc.date}`);
      if (proc.findings) lines.push(`   Findings: ${proc.findings}`);
      if (proc.status) lines.push(`   Status: ${proc.status}`);
    });
    lines.push('');
  }

  // Lab Results
  if (doc.labResults && doc.labResults.length > 0) {
    lines.push(`=== LABORATORY RESULTS (${doc.labResults.length} tests) ===`);
    doc.labResults.forEach(lab => {
      const flag = lab.flag ? ` [${lab.flag.toUpperCase()}]` : '';
      const range = lab.referenceRange ? ` (Normal: ${lab.referenceRange})` : '';
      const unit = lab.unit || '';
      lines.push(`  • ${lab.testName}: ${lab.value} ${unit}${flag}${range}`);
    });
    lines.push('');
  }

  // IMAGING - CRITICAL SECTION
  if (doc.imaging && doc.imaging.length > 0) {
    lines.push('=== IMAGING STUDIES ===');
    doc.imaging.forEach((img, idx) => {
      lines.push(`\n${idx + 1}. ${img.modality}:`);
      if (img.findings) {
        lines.push(`   Findings: ${img.findings}`);
      }
      if (img.date) {
        lines.push(`   Date: ${img.date}`);
      }
      if (img.interpretation) {
        lines.push(`   Interpretation: ${img.interpretation}`);
      }
    });
    lines.push('');
  }

  // Medications on Discharge
  if (doc.medications && doc.medications.length > 0) {
    lines.push(`=== DISCHARGE MEDICATIONS (${doc.medications.length}) ===`);
    doc.medications.forEach((med, idx) => {
      const name = med.name || med.medicationName;
      const dose = med.dosage || '';
      const freq = med.frequency || '';
      const route = med.route || '';
      const prn = med.prn ? ' PRN' : '';
      const duration = med.duration ? ` for ${med.duration}` : '';
      const indication = med.indication ? ` - ${med.indication}` : '';
      const status = med.status ? ` (${med.status})` : '';
      lines.push(`${idx + 1}. ${name} ${dose} ${freq} ${route}${prn}${duration}${indication}${status}`.trim());
    });
    lines.push('');
  }

  // Follow-up Appointments
  if (doc.followUpAppointments && doc.followUpAppointments.length > 0) {
    lines.push('=== FOLLOW-UP APPOINTMENTS ===');
    doc.followUpAppointments.forEach((appt, idx) => {
      let apptLine = `${idx + 1}. ${appt.specialty}`;
      if (appt.provider) apptLine += ` with ${appt.provider}`;
      apptLine += ` - ${appt.timing}`;
      if (appt.type) apptLine += ` (${appt.type})`;
      lines.push(apptLine);
      if (appt.isScheduled !== undefined) {
        lines.push(`   Status: ${appt.isScheduled ? 'Scheduled' : 'Not Scheduled'}`);
      }
    });
    lines.push('');
  }

  // Patient Education
  if (doc.patientEducation && doc.patientEducation.topics) {
    lines.push('=== PATIENT EDUCATION ===');
    doc.patientEducation.topics.forEach((topic, idx) => {
      if (typeof topic === 'string') {
        lines.push(`${idx + 1}. ${topic}`);
      } else {
        lines.push(`${idx + 1}. ${topic.topic || topic.name}`);
        if (topic.details) lines.push(`   Details: ${topic.details}`);
      }
    });
    lines.push('');
  }

  // Emergency Information
  if (doc.emergencyInformation && doc.emergencyInformation.whenToCall) {
    lines.push('=== WHEN TO SEEK EMERGENCY CARE ===');
    doc.emergencyInformation.whenToCall.forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item}`);
    });
    lines.push('');
  }

  // Clinical Decision Support (AI-generated)
  if (doc.clinicalDecisionSupport) {
    lines.push('=== CLINICAL DECISION SUPPORT (AI-GENERATED) ===');
    const cds = doc.clinicalDecisionSupport;

    if (cds.riskAssessment) {
      lines.push('\nRisk Assessment:');
      if (cds.riskAssessment.overallRisk) lines.push(`  Overall Risk: ${cds.riskAssessment.overallRisk}`);
      if (cds.riskAssessment.riskFactors && cds.riskAssessment.riskFactors.length > 0) {
        lines.push('  Risk Factors:');
        cds.riskAssessment.riskFactors.forEach((rf, idx) => {
          lines.push(`    ${idx + 1}. ${rf.factor} (${rf.severity})`);
          if (rf.evidence) lines.push(`       Evidence: ${rf.evidence}`);
        });
      }
      if (cds.riskAssessment.mitigatingFactors && cds.riskAssessment.mitigatingFactors.length > 0) {
        lines.push('  Mitigating Factors:');
        cds.riskAssessment.mitigatingFactors.forEach(mf => lines.push(`    • ${mf}`));
      }
    }

    if (cds.redFlags && cds.redFlags.length > 0) {
      lines.push('\nRed Flags:');
      cds.redFlags.forEach((flag, idx) => {
        lines.push(`  ${idx + 1}. ${flag.finding} (${flag.urgency || 'Monitor'})`);
        lines.push(`     Action: ${flag.action}`);
        if (flag.timeframe) lines.push(`     Timeframe: ${flag.timeframe}`);
      });
    }

    if (cds.drugInteractions && cds.drugInteractions.length > 0) {
      lines.push('\nDrug Interactions:');
      cds.drugInteractions.forEach((di, idx) => {
        const medications = Array.isArray(di.medications) ? di.medications.join(' + ') : di.medications;
        lines.push(`  ${idx + 1}. ${medications} (${di.severity})`);
        if (di.clinicalEffect) lines.push(`     Effect: ${di.clinicalEffect}`);
        if (di.mechanism) lines.push(`     Mechanism: ${di.mechanism}`);
        if (di.recommendation) lines.push(`     Recommendation: ${di.recommendation}`);
      });
    }

    if (cds.contraindications && cds.contraindications.length > 0) {
      lines.push('\nContraindications:');
      cds.contraindications.forEach((ci, idx) => {
        const medication = ci.medication || ci.drug;
        lines.push(`  ${idx + 1}. ${medication} - ${ci.condition} (${ci.severity})`);
        if (ci.alternative) lines.push(`     Alternative: ${ci.alternative}`);
      });
    }
    lines.push('');
  }

  // Intelligent Recommendations (AI-generated)
  if (doc.intelligentRecommendations) {
    lines.push('=== AI RECOMMENDATIONS (AI-GENERATED) ===');
    const ir = doc.intelligentRecommendations;

    if (ir.immediate && ir.immediate.length > 0) {
      lines.push('\nImmediate Actions:');
      ir.immediate.forEach((action, idx) => {
        const actionText = typeof action === 'string' ? action : action.action;
        lines.push(`  ${idx + 1}. ${actionText}`);
        if (action.rationale) lines.push(`     Rationale: ${action.rationale}`);
        if (action.priority) lines.push(`     Priority: ${action.priority}`);
        if (action.evidence) lines.push(`     Evidence: ${action.evidence}`);
      });
    }

    if (ir.shortTerm && ir.shortTerm.length > 0) {
      lines.push('\nShort-term Recommendations:');
      ir.shortTerm.forEach((rec, idx) => {
        const recText = typeof rec === 'string' ? rec : rec.action;
        lines.push(`  ${idx + 1}. ${recText}`);
        if (rec.timeframe) lines.push(`     Timeframe: ${rec.timeframe}`);
        if (rec.expectedOutcome) lines.push(`     Expected Outcome: ${rec.expectedOutcome}`);
      });
    }

    if (ir.longTerm && ir.longTerm.length > 0) {
      lines.push('\nLong-term Goals:');
      ir.longTerm.forEach((rec, idx) => {
        const recText = typeof rec === 'string' ? rec : rec.goal;
        lines.push(`  ${idx + 1}. ${recText}`);
        if (rec.interventions && rec.interventions.length > 0) {
          lines.push('     Interventions:');
          rec.interventions.forEach(i => lines.push(`       • ${i}`));
        }
        if (rec.timeline) lines.push(`     Timeline: ${rec.timeline}`);
      });
    }

    if (ir.preventive && ir.preventive.length > 0) {
      lines.push('\nPreventive Care:');
      ir.preventive.forEach((prev, idx) => {
        const prevText = typeof prev === 'string' ? prev : prev.screening;
        lines.push(`  ${idx + 1}. ${prevText}`);
        if (prev.indication) lines.push(`     Indication: ${prev.indication}`);
        if (prev.dueDate) lines.push(`     Due: ${prev.dueDate}`);
      });
    }
    lines.push('');
  }

  // Trending Analysis (AI-generated)
  if (doc.trendingAnalysis) {
    lines.push('=== TRENDING ANALYSIS (AI-GENERATED) ===');
    const ta = doc.trendingAnalysis;

    if (ta.diseaseProgression) {
      lines.push('\nDisease Progression:');
      if (ta.diseaseProgression.trajectory) lines.push(`  Trajectory: ${ta.diseaseProgression.trajectory}`);
      if (ta.diseaseProgression.timeline) lines.push(`  Timeline: ${ta.diseaseProgression.timeline}`);
      if (ta.diseaseProgression.keyEvents && ta.diseaseProgression.keyEvents.length > 0) {
        lines.push('  Key Events:');
        ta.diseaseProgression.keyEvents.forEach((event, idx) => {
          lines.push(`    ${idx + 1}. ${event.date}: ${event.event}`);
          if (event.impact) lines.push(`       Impact: ${event.impact}`);
        });
      }
      if (ta.diseaseProgression.prognosis) lines.push(`  Prognosis: ${ta.diseaseProgression.prognosis}`);
    }

    if (ta.labTrends && ta.labTrends.length > 0) {
      lines.push('\nLaboratory Trends:');
      ta.labTrends.forEach((trend, idx) => {
        lines.push(`  ${idx + 1}. ${trend.test}:`);
        if (trend.trend) lines.push(`     Trend: ${trend.trend}`);
        if (trend.latestValue) lines.push(`     Latest: ${trend.latestValue}`);
        if (trend.interpretation) lines.push(`     Interpretation: ${trend.interpretation}`);
        if (trend.actionNeeded) {
          const priority = trend.priority ? ` (${trend.priority})` : '';
          lines.push(`     Action: ${trend.actionNeeded}${priority}`);
        }
        if (trend.targetValue) lines.push(`     Target: ${trend.targetValue}`);
      });
    }

    if (ta.vitalSignsTrends && ta.vitalSignsTrends.length > 0) {
      lines.push('\nVital Signs Trends:');
      ta.vitalSignsTrends.forEach((trend, idx) => {
        lines.push(`  ${idx + 1}. ${trend.parameter}: ${trend.trend}`);
        if (trend.interpretation) lines.push(`     ${trend.interpretation}`);
        if (trend.actionNeeded) lines.push(`     Action: ${trend.actionNeeded}`);
      });
    }
    lines.push('');
  }

  // Patient-Specific Care Plan (AI-generated)
  if (doc.patientSpecificCarePlan) {
    lines.push('=== PATIENT-SPECIFIC CARE PLAN (AI-GENERATED) ===');
    const pscp = doc.patientSpecificCarePlan;

    if (pscp.tailoredInterventions && pscp.tailoredInterventions.length > 0) {
      lines.push('\nTailored Interventions:');
      pscp.tailoredInterventions.forEach((intervention, idx) => {
        lines.push(`  ${idx + 1}. ${intervention.intervention}`);
        if (intervention.patientContext) lines.push(`     Context: ${intervention.patientContext}`);
        if (intervention.barriers && intervention.barriers.length > 0) {
          lines.push('     Barriers:');
          intervention.barriers.forEach(b => lines.push(`       • ${b}`));
        }
        if (intervention.enablers && intervention.enablers.length > 0) {
          lines.push('     Enablers:');
          intervention.enablers.forEach(e => lines.push(`       • ${e}`));
        }
        if (intervention.adherenceStrategy) lines.push(`     Strategy: ${intervention.adherenceStrategy}`);
      });
    }

    if (pscp.lifestyleModifications && pscp.lifestyleModifications.length > 0) {
      lines.push('\nLifestyle Modifications:');
      pscp.lifestyleModifications.forEach((mod, idx) => {
        lines.push(`  ${idx + 1}. ${mod.domain}`);
        if (mod.currentStatus) lines.push(`     Current: ${mod.currentStatus}`);
        if (mod.recommendation) lines.push(`     Recommendation: ${mod.recommendation}`);
        if (mod.expectedBenefit) lines.push(`     Expected Benefit: ${mod.expectedBenefit}`);
      });
    }

    if (pscp.comorbidityManagement) {
      lines.push('\nComorbidity Management:');
      const cm = pscp.comorbidityManagement;
      if (cm.integratedApproach) lines.push(`  Approach: ${cm.integratedApproach}`);
      if (cm.interactions && cm.interactions.length > 0) {
        lines.push('  Interactions:');
        cm.interactions.forEach(i => lines.push(`    • ${i}`));
      }
      if (cm.prioritization) lines.push(`  Prioritization: ${cm.prioritization}`);
    }
    lines.push('');
  }

  // Medication Optimization (AI-generated)
  if (doc.medicationsOptimizations) {
    lines.push('=== MEDICATION OPTIMIZATION (AI-GENERATED) ===');
    const mo = doc.medicationsOptimizations;

    if (mo.costAnalysis && mo.costAnalysis.length > 0) {
      lines.push('\nCost Analysis:');
      mo.costAnalysis.forEach((item, idx) => {
        lines.push(`  ${idx + 1}. ${item.medication}`);
        if (item.estimatedCost) lines.push(`     Cost: ${item.estimatedCost}`);
        if (item.insuranceCoverage) lines.push(`     Insurance: ${item.insuranceCoverage}`);
        if (item.alternatives && item.alternatives.length > 0) {
          lines.push('     Alternatives:');
          item.alternatives.forEach(alt => {
            lines.push(`       • ${alt.name} - ${alt.cost}`);
            if (alt.efficacyComparison) lines.push(`         ${alt.efficacyComparison}`);
          });
        }
      });
    }

    if (mo.adherenceRisk) {
      lines.push('\nAdherence Assessment:');
      if (mo.adherenceRisk.riskLevel) lines.push(`  Risk Level: ${mo.adherenceRisk.riskLevel}`);
      if (mo.adherenceRisk.riskFactors && mo.adherenceRisk.riskFactors.length > 0) {
        lines.push('  Risk Factors:');
        mo.adherenceRisk.riskFactors.forEach(rf => lines.push(`    • ${rf}`));
      }
      if (mo.adherenceRisk.mitigationStrategies && mo.adherenceRisk.mitigationStrategies.length > 0) {
        lines.push('  Mitigation Strategies:');
        mo.adherenceRisk.mitigationStrategies.forEach(ms => lines.push(`    • ${ms}`));
      }
    }

    if (mo.simplificationOpportunities && mo.simplificationOpportunities.length > 0) {
      lines.push('\nSimplification Opportunities:');
      mo.simplificationOpportunities.forEach((opp, idx) => {
        lines.push(`  ${idx + 1}. Current: ${opp.current}`);
        if (opp.proposed) lines.push(`     Proposed: ${opp.proposed}`);
        if (opp.benefit) lines.push(`     Benefit: ${opp.benefit}`);
      });
    }
    lines.push('');
  }

  // Follow-up Intelligence (AI-generated)
  if (doc.followUpIntelligence) {
    lines.push('=== FOLLOW-UP INTELLIGENCE (AI-GENERATED) ===');
    const fi = doc.followUpIntelligence;

    if (fi.deadlines && fi.deadlines.length > 0) {
      lines.push('\nCritical Deadlines:');
      fi.deadlines.forEach((dl, idx) => {
        lines.push(`  ${idx + 1}. ${dl.item} - Due: ${dl.dueDate} (${dl.criticality})`);
        if (dl.consequences) lines.push(`     Consequences: ${dl.consequences}`);
        if (dl.autoSchedule) lines.push(`     Auto-schedule: Yes`);
      });
    }

    if (fi.prioritization && fi.prioritization.length > 0) {
      lines.push('\nTask Prioritization:');
      fi.prioritization.forEach((task, idx) => {
        lines.push(`  ${idx + 1}. ${task.task} (${task.urgency})`);
        if (task.importance) lines.push(`     Importance: ${task.importance}`);
      });
    }

    if (fi.coordinationNeeds && fi.coordinationNeeds.length > 0) {
      lines.push('\nCare Coordination Needs:');
      fi.coordinationNeeds.forEach((coord, idx) => {
        lines.push(`  ${idx + 1}. ${coord.specialist} (${coord.urgency})`);
        if (coord.reason) lines.push(`     Reason: ${coord.reason}`);
        if (coord.informationNeeded && coord.informationNeeded.length > 0) {
          lines.push('     Information Needed:');
          coord.informationNeeded.forEach(info => lines.push(`       • ${info}`));
        }
      });
    }

    if (fi.overallTreatmentGoals) {
      lines.push('\nOverall Treatment Goals:');
      const otg = fi.overallTreatmentGoals;
      if (otg.primaryGoal) lines.push(`  Primary Goal: ${otg.primaryGoal}`);
      if (otg.quantitativeTargets && otg.quantitativeTargets.length > 0) {
        lines.push('  Quantitative Targets:');
        otg.quantitativeTargets.forEach(target => {
          lines.push(`    • ${target.parameter}: ${target.currentValue} → ${target.targetValue} (${target.timeframe})`);
        });
      }
    }
    lines.push('');
  }

  // Patient Education Context (AI-generated)
  if (doc.patientEducationContext) {
    lines.push('=== DETAILED PATIENT EDUCATION (AI-GENERATED) ===');
    const pec = doc.patientEducationContext;

    if (pec.conditionExplanation) {
      lines.push('\nUnderstanding Your Condition:');
      if (pec.conditionExplanation.simplifiedSummary) {
        lines.push(`  ${pec.conditionExplanation.simplifiedSummary}`);
      }
      if (pec.conditionExplanation.keyPoints && pec.conditionExplanation.keyPoints.length > 0) {
        lines.push('  Key Points:');
        pec.conditionExplanation.keyPoints.forEach(kp => lines.push(`    • ${kp}`));
      }
      if (pec.conditionExplanation.warningSignsToWatch && pec.conditionExplanation.warningSignsToWatch.length > 0) {
        lines.push('  Warning Signs to Watch:');
        pec.conditionExplanation.warningSignsToWatch.forEach(ws => lines.push(`    • ${ws}`));
      }
    }

    if (pec.medicationInstructions && pec.medicationInstructions.length > 0) {
      lines.push('\nMedication Instructions:');
      pec.medicationInstructions.forEach((med, idx) => {
        lines.push(`  ${idx + 1}. ${med.medication}`);
        if (med.purpose) lines.push(`     Purpose: ${med.purpose}`);
        if (med.howToTake) lines.push(`     How to Take: ${med.howToTake}`);
        if (med.commonSideEffects && med.commonSideEffects.length > 0) {
          lines.push('     Common Side Effects:');
          med.commonSideEffects.forEach(se => lines.push(`       • ${se}`));
        }
      });
    }

    if (pec.lifestyleGuidance && pec.lifestyleGuidance.length > 0) {
      lines.push('\nLifestyle Guidance:');
      pec.lifestyleGuidance.forEach((guide, idx) => {
        lines.push(`  ${idx + 1}. ${guide.topic}`);
        if (guide.recommendation) lines.push(`     Recommendation: ${guide.recommendation}`);
        if (guide.reasoning) lines.push(`     Reasoning: ${guide.reasoning}`);
      });
    }
    lines.push('');
  }

  // Guideline Compliance & Care Gaps (AI-generated)
  if (doc.guidelineCompliance || doc.careGaps) {
    lines.push('=== GUIDELINE COMPLIANCE & CARE GAPS (AI-GENERATED) ===');

    if (doc.guidelineCompliance && doc.guidelineCompliance.guidelines) {
      lines.push('\nGuideline Compliance:');
      doc.guidelineCompliance.guidelines.forEach((guideline, idx) => {
        lines.push(`  ${idx + 1}. ${guideline.guidelineName} - ${guideline.compliance}`);
        if (guideline.gaps && guideline.gaps.length > 0) {
          lines.push('     Gaps:');
          guideline.gaps.forEach(gap => lines.push(`       • ${gap}`));
        }
      });
    }

    if (doc.careGaps && doc.careGaps.screenings) {
      lines.push('\nCare Gaps - Screening Needs:');
      doc.careGaps.screenings.forEach((gap, idx) => {
        lines.push(`  ${idx + 1}. ${gap.screeningType} - ${gap.status}`);
        if (gap.actionRequired) lines.push(`     Action: ${gap.actionRequired}`);
        if (gap.priority) lines.push(`     Priority: ${gap.priority}`);
        if (gap.dueDate) lines.push(`     Due: ${gap.dueDate}`);
      });
    }
    lines.push('');
  }

  // Outcomes Prediction (AI-generated)
  if (doc.outcomesPrediction) {
    lines.push('=== OUTCOMES PREDICTION & PROGNOSIS (AI-GENERATED) ===');
    const op = doc.outcomesPrediction;

    if (op.priority) lines.push(`Overall Priority: ${op.priority}`);
    if (op.prognosis) lines.push(`\nPrognosis:\n${op.prognosis}`);
    if (op.expectedOutcomes) lines.push(`\nExpected Outcomes:\n${op.expectedOutcomes}`);

    if (op.modifiableFactors && op.modifiableFactors.length > 0) {
      lines.push('\nModifiable Factors:');
      op.modifiableFactors.forEach((factor, idx) => {
        lines.push(`  ${idx + 1}. ${factor.factor}`);
        if (factor.impact) lines.push(`     Impact: ${factor.impact}`);
        if (factor.recommendation) lines.push(`     Recommendation: ${factor.recommendation}`);
      });
    }
    lines.push('');
  }

  // Quality Metrics (AI-generated)
  if (doc.qualityMetrics) {
    lines.push('=== QUALITY METRICS (AI-GENERATED) ===');
    for (const [key, value] of Object.entries(doc.qualityMetrics)) {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      lines.push(`  ${label}: ${value}`);
    }
    lines.push('');
  }

  return lines.join('\n');
};
