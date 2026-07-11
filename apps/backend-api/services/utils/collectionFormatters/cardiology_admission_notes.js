/**
 * Cardiology Admission Notes Formatter
 *
 * Formats unified cardiology admission documents for Claude AI context
 * Presents ALL medical data in organized, readable format
 */

module.exports = function formatCardiologyAdmissionNotes(doc) {
  const lines = [];

  // Patient Demographics
  lines.push('=== PATIENT DEMOGRAPHICS ===');
  if (doc.patientName) lines.push(`Name: ${doc.patientName}`);
  if (doc.dateOfBirth) lines.push(`DOB: ${doc.dateOfBirth}`);
  if (doc.age) lines.push(`Age: ${doc.age} years`);
  if (doc.gender) lines.push(`Gender: ${doc.gender}`);
  if (doc.race) lines.push(`Race: ${doc.race}`);
  if (doc.ethnicity) lines.push(`Ethnicity: ${doc.ethnicity}`);
  if (doc.mrn || doc.patientId) lines.push(`MRN: ${doc.mrn || doc.patientId}`);
  if (doc.date || doc.documentDate) lines.push(`Admission Date: ${doc.date || doc.documentDate}`);

  // Contact Information
  if (doc.contactInformation) {
    lines.push('\nContact Information:');
    const ci = doc.contactInformation;
    if (ci.address) lines.push(`  Address: ${ci.address}`);
    if (ci.city && ci.state) lines.push(`  City/State: ${ci.city}, ${ci.state} ${ci.zipCode || ''}`);
    if (ci.phone) lines.push(`  Phone: ${ci.phone}`);
    if (ci.email) lines.push(`  Email: ${ci.email}`);
    if (ci.emergencyContact) {
      lines.push(`  Emergency Contact: ${ci.emergencyContact.name} (${ci.emergencyContact.relationship}) - ${ci.emergencyContact.phone}`);
    }
  }
  lines.push('');

  // Chief Complaint
  if (doc.chiefComplaint) {
    lines.push('=== CHIEF COMPLAINT ===');
    if (typeof doc.chiefComplaint === 'string') {
      lines.push(doc.chiefComplaint);
    } else {
      lines.push(`Complaint: ${doc.chiefComplaint.complaint}`);
      if (doc.chiefComplaint.duration) lines.push(`Duration: ${doc.chiefComplaint.duration}`);
    }
    lines.push('');
  }

  // History of Present Illness
  if (doc.historyOfPresentIllness) {
    lines.push('=== HISTORY OF PRESENT ILLNESS ===');
    lines.push(doc.historyOfPresentIllness);
    lines.push('');
  }

  // Medical History
  if (doc.medicalHistory) {
    lines.push('=== MEDICAL HISTORY ===');

    // Past Medical History
    if (doc.medicalHistory.pastMedicalHistory && doc.medicalHistory.pastMedicalHistory.length > 0) {
      lines.push('\nPast Medical History:');
      doc.medicalHistory.pastMedicalHistory.forEach((pmh, idx) => {
        lines.push(`  ${idx + 1}. ${pmh.condition}${pmh.status ? ` (${pmh.status})` : ''}`);
        if (pmh.dateOfOnset) lines.push(`     Onset: ${pmh.dateOfOnset}`);
        if (pmh.treatment) lines.push(`     Treatment: ${pmh.treatment}`);
        if (pmh.anatomicalDetails) lines.push(`     Details: ${pmh.anatomicalDetails}`);
      });
    }

    // Surgical History
    if (doc.medicalHistory.surgicalHistory && doc.medicalHistory.surgicalHistory.length > 0) {
      lines.push('\nSurgical History:');
      doc.medicalHistory.surgicalHistory.forEach((surg, idx) => {
        lines.push(`  ${idx + 1}. ${surg.procedure} (${surg.date})`);
      });
    }

    // Family History
    if (doc.medicalHistory.familyHistory && doc.medicalHistory.familyHistory.conditions) {
      lines.push('\nFamily History:');
      doc.medicalHistory.familyHistory.conditions.forEach((fh, idx) => {
        let fhLine = `  ${idx + 1}. ${fh.relationship}: ${fh.condition}`;
        if (fh.ageAtOnset) fhLine += ` (onset at ${fh.ageAtOnset})`;
        if (fh.ageAtDeath) fhLine += ` - died at ${fh.ageAtDeath}`;
        if (fh.causeOfDeath) fhLine += ` from ${fh.causeOfDeath}`;
        lines.push(fhLine);
      });
    }

    // Social History
    if (doc.medicalHistory.socialHistory) {
      lines.push('\nSocial History:');
      const sh = doc.medicalHistory.socialHistory;
      if (sh.tobacco) lines.push(`  Tobacco: ${sh.tobacco}`);
      if (sh.alcohol) {
        const alc = typeof sh.alcohol === 'string' ? sh.alcohol :
          `${sh.alcohol.status || ''} - ${sh.alcohol.amount || ''} ${sh.alcohol.frequency || ''}`;
        lines.push(`  Alcohol: ${alc}`);
      }
      if (sh.drugs) {
        const drugs = typeof sh.drugs === 'string' ? sh.drugs : sh.drugs.status;
        lines.push(`  Drugs: ${drugs}`);
      }
      if (sh.exercise) lines.push(`  Exercise: ${sh.exercise}`);
      if (sh.diet) lines.push(`  Diet: ${sh.diet}`);
      if (sh.stress) lines.push(`  Stress: ${sh.stress}`);
      if (sh.sleep) lines.push(`  Sleep: ${sh.sleep}`);
      if (sh.occupation) lines.push(`  Occupation: ${sh.occupation}`);
    }
    lines.push('');
  }

  // Allergies
  if (doc.allergies && doc.allergies.length > 0) {
    lines.push('=== ALLERGIES ===');
    doc.allergies.forEach((allergy, idx) => {
      const allergen = allergy.allergen || allergy.allergyName;
      const reaction = allergy.reaction || '';
      const severity = allergy.severity ? ` (${allergy.severity})` : '';
      lines.push(`${idx + 1}. ${allergen}: ${reaction}${severity}`);
    });
    lines.push('');
  }

  // Medications
  if (doc.medications && doc.medications.length > 0) {
    lines.push(`=== CURRENT MEDICATIONS (${doc.medications.length}) ===`);
    doc.medications.forEach((med, idx) => {
      const name = med.name || med.medicationName;
      const dose = med.dosage || '';
      const freq = med.frequency || '';
      const route = med.route || '';
      const indication = med.indication ? ` - ${med.indication}` : '';
      lines.push(`${idx + 1}. ${name} ${dose} ${freq} ${route}${indication}`.trim());
    });
    lines.push('');
  }

  // Vital Signs
  if (doc.vitalSigns) {
    lines.push('=== VITAL SIGNS ===');
    const vs = doc.vitalSigns;
    if (vs.bloodPressure) lines.push(`Blood Pressure: ${vs.bloodPressure}`);
    if (vs.heartRate) lines.push(`Heart Rate: ${vs.heartRate}`);
    if (vs.respiratoryRate) lines.push(`Respiratory Rate: ${vs.respiratoryRate}`);
    if (vs.temperature) lines.push(`Temperature: ${vs.temperature}`);
    if (vs.oxygenSaturation) lines.push(`Oxygen Saturation: ${vs.oxygenSaturation}`);
    if (vs.weight) lines.push(`Weight: ${vs.weight}`);
    if (vs.height) lines.push(`Height: ${vs.height}`);
    if (vs.bmi) lines.push(`BMI: ${vs.bmi}`);
    lines.push('');
  }

  // Physical Examination
  if (doc.physicalExamination) {
    lines.push('=== PHYSICAL EXAMINATION ===');
    const pe = doc.physicalExamination;

    if (pe.general) lines.push(`General: ${pe.general}`);

    if (pe.heent) {
      lines.push('HEENT:');
      if (pe.heent.neck) lines.push(`  Neck: ${pe.heent.neck}`);
    }

    if (pe.cardiovascular) {
      lines.push('Cardiovascular:');
      if (pe.cardiovascular.rhythm) lines.push(`  Rhythm: ${pe.cardiovascular.rhythm}`);
      if (pe.cardiovascular.sounds) lines.push(`  Sounds: ${pe.cardiovascular.sounds}`);
      if (pe.cardiovascular.findings) lines.push(`  Findings: ${pe.cardiovascular.findings}`);
      if (pe.cardiovascular.s4Gallop) lines.push(`  S4 Gallop: Present`);
    }

    if (pe.respiratory) {
      lines.push('Respiratory:');
      if (pe.respiratory.sounds) lines.push(`  Sounds: ${pe.respiratory.sounds}`);
    }

    if (pe.abdomen) {
      lines.push('Abdomen:');
      if (pe.abdomen.inspection) lines.push(`  ${pe.abdomen.inspection}`);
    }

    if (pe.extremities) lines.push(`Extremities: ${pe.extremities}`);

    if (pe.neurological) {
      lines.push('Neurological:');
      if (pe.neurological.mental) lines.push(`  Mental Status: ${pe.neurological.mental}`);
    }
    lines.push('');
  }

  // Review of Systems
  if (doc.reviewOfSystems) {
    lines.push('=== REVIEW OF SYSTEMS ===');
    const ros = doc.reviewOfSystems;
    for (const [system, finding] of Object.entries(ros)) {
      const systemName = system.charAt(0).toUpperCase() + system.slice(1);
      if (typeof finding === 'string') {
        lines.push(`${systemName}: ${finding}`);
      } else if (typeof finding === 'object' && finding.symptoms) {
        lines.push(`${systemName}: ${finding.symptoms}`);
      }
    }
    lines.push('');
  }

  // Lab Results
  if (doc.labResults && doc.labResults.length > 0) {
    lines.push(`=== LABORATORY RESULTS (${doc.labResults.length}) ===`);

    // Group by category
    const labsByCategory = {};
    doc.labResults.forEach(lab => {
      const category = lab.category || 'Other';
      if (!labsByCategory[category]) labsByCategory[category] = [];
      labsByCategory[category].push(lab);
    });

    for (const [category, labs] of Object.entries(labsByCategory)) {
      lines.push(`\n${category}:`);
      labs.forEach(lab => {
        const flag = lab.flag ? ` [${lab.flag.toUpperCase()}]` : '';
        const interpretation = lab.interpretation ? ` (${lab.interpretation})` : '';
        const result = lab.result || `${lab.value} ${lab.unit || ''}`;
        lines.push(`  • ${lab.testName}: ${result}${flag}${interpretation}`);
      });
    }
    lines.push('');
  }

  // Imaging
  if (doc.imaging && doc.imaging.length > 0) {
    lines.push('=== IMAGING ===');
    doc.imaging.forEach((img, idx) => {
      lines.push(`\n${idx + 1}. ${img.modality}:`);
      lines.push(`   Findings: ${img.findings}`);
    });
    lines.push('');
  }

  // Procedures
  if (doc.procedures && doc.procedures.length > 0) {
    lines.push('=== PROCEDURES ===');
    doc.procedures.forEach((proc, idx) => {
      lines.push(`\n${idx + 1}. ${proc.name || proc.procedureName}`);
      if (proc.date) lines.push(`   Date: ${proc.date}`);
      if (proc.time) lines.push(`   Time: ${proc.time}`);
      if (proc.findings) lines.push(`   Findings: ${proc.findings}`);
      if (proc.status) lines.push(`   Status: ${proc.status}`);
    });
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

  // Risk Factors
  if (doc.riskFactors && doc.riskFactors.length > 0) {
    lines.push('=== RISK FACTORS ===');
    doc.riskFactors.forEach((rf, idx) => {
      const category = rf.category ? ` (${rf.category})` : '';
      lines.push(`${idx + 1}. ${rf.factor}${category}`);
    });
    lines.push('');
  }

  // Cardiology Assessment
  if (doc.cardiologyAssessment) {
    lines.push('=== CARDIOLOGY ASSESSMENT ===');
    const ca = doc.cardiologyAssessment;

    if (ca.cathFindings) {
      lines.push('\nCath Findings:');
      if (ca.cathFindings.vessels) {
        ca.cathFindings.vessels.forEach(v => {
          lines.push(`  • ${v.vessel}: ${v.stenosis}`);
          if (v.intervention) lines.push(`    Intervention: ${v.intervention}`);
          if (v.result) lines.push(`    Result: ${v.result}`);
        });
      }
      if (ca.cathFindings.doorToBalloonTime) lines.push(`  Door-to-Balloon Time: ${ca.cathFindings.doorToBalloonTime}`);
      if (ca.cathFindings.timiFlow) lines.push(`  TIMI Flow: ${ca.cathFindings.timiFlow}`);
    }

    if (ca.echoFindings) {
      lines.push('\nEcho Findings:');
      if (ca.echoFindings.ef) lines.push(`  Ejection Fraction: ${ca.echoFindings.ef}`);
      if (ca.echoFindings.wallMotion) lines.push(`  Wall Motion: ${ca.echoFindings.wallMotion}`);
      if (ca.echoFindings.valves) lines.push(`  Valves: ${ca.echoFindings.valves}`);
    }

    if (ca.biomarkers) {
      lines.push('\nBiomarkers:');
      if (ca.biomarkers.troponin) {
        lines.push('  Troponin:');
        ca.biomarkers.troponin.forEach(t => {
          lines.push(`    ${t.date}: ${t.level} (${t.medication})`);
        });
      }
      if (ca.biomarkers.ckmb) lines.push(`  CK-MB: ${ca.biomarkers.ckmb}`);
      if (ca.biomarkers.bnp) lines.push(`  BNP: ${ca.biomarkers.bnp}`);
    }
    lines.push('');
  }

  // Clinical Scores
  if (doc.clinicalScores) {
    lines.push('=== CLINICAL SCORES ===');
    for (const [score, value] of Object.entries(doc.clinicalScores)) {
      lines.push(`${score}: ${value}`);
    }
    lines.push('');
  }

  // ED Disposition
  if (doc.edDisposition) {
    lines.push('=== ED DISPOSITION ===');
    const ed = doc.edDisposition;
    if (ed.decision) lines.push(`Decision: ${ed.decision}`);
    if (ed.admitTo) lines.push(`Admit To: ${ed.admitTo}`);
    if (ed.doorToBalloonTime) lines.push(`Door-to-Balloon Time: ${ed.doorToBalloonTime}`);
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

    if (doc.treatmentCourse.monitoring) {
      lines.push('\nMonitoring:');
      const mon = doc.treatmentCourse.monitoring;
      if (mon.icuLevel) lines.push(`  ${mon.icuLevel}`);
      if (mon.parameters) {
        mon.parameters.forEach(p => lines.push(`  • ${p}`));
      }
    }
    lines.push('');
  }

  // Treatment Plan
  if (doc.treatmentPlan) {
    lines.push('=== TREATMENT PLAN ===');
    const tp = doc.treatmentPlan;

    if (tp.immediateInterventions) {
      lines.push('\nImmediate Interventions:');
      for (const [key, value] of Object.entries(tp.immediateInterventions)) {
        if (typeof value === 'object' && value.target) {
          lines.push(`  ${key}: ${value.target}`);
        }
      }
    }

    if (tp.cardiovascularRiskReduction) {
      lines.push('\nCardiovascular Risk Reduction:');
      const crr = tp.cardiovascularRiskReduction;
      for (const [key, value] of Object.entries(crr)) {
        if (typeof value === 'boolean') {
          lines.push(`  ${key}: ${value ? 'Yes' : 'No'}`);
        } else if (typeof value === 'object' && value.type) {
          lines.push(`  ${key}: ${value.type}${value.duration ? ` - ${value.duration}` : ''}`);
        } else {
          lines.push(`  ${key}: ${value}`);
        }
      }
    }

    if (tp.treatmentTargets) {
      lines.push('\nTreatment Targets:');
      for (const [key, value] of Object.entries(tp.treatmentTargets)) {
        lines.push(`  ${key}: ${value}`);
      }
    }

    if (tp.pendingProcedures && tp.pendingProcedures.length > 0) {
      lines.push('\nPending Procedures:');
      tp.pendingProcedures.forEach((proc, idx) => {
        lines.push(`  ${idx + 1}. ${proc.procedure} - ${proc.timing}`);
        if (proc.indication) lines.push(`     Indication: ${proc.indication}`);
      });
    }
    lines.push('');
  }

  // Medication Changes
  if (doc.medicationChanges) {
    lines.push('=== MEDICATION CHANGES ===');

    if (doc.medicationChanges.newMedications && doc.medicationChanges.newMedications.length > 0) {
      lines.push('\nNew Medications:');
      doc.medicationChanges.newMedications.forEach((med, idx) => {
        lines.push(`  ${idx + 1}. ${med.medication} ${med.dose} ${med.frequency} ${med.route || ''}`);
        if (med.indication) lines.push(`     Indication: ${med.indication}`);
        if (med.duration) lines.push(`     Duration: ${med.duration}`);
      });
    }

    if (doc.medicationChanges.doseChanges && doc.medicationChanges.doseChanges.length > 0) {
      lines.push('\nDose Changes:');
      doc.medicationChanges.doseChanges.forEach((change, idx) => {
        lines.push(`  ${idx + 1}. ${change.medication}: ${change.previousDose} → ${change.newDose}`);
        if (change.reason) lines.push(`     Reason: ${change.reason}`);
      });
    }
    lines.push('');
  }

  // Monitoring Plan
  if (doc.monitoringPlan) {
    lines.push('=== MONITORING PLAN ===');
    const mp = doc.monitoringPlan;
    if (mp.laboratory) lines.push(`Laboratory: ${mp.laboratory}`);
    if (mp.clinical) lines.push(`Clinical: ${mp.clinical}`);
    if (mp.labTiming) lines.push(`Lab Timing: ${mp.labTiming}`);
    lines.push('');
  }

  // Patient Education
  if (doc.patientEducation && doc.patientEducation.topics) {
    lines.push('=== PATIENT EDUCATION ===');
    doc.patientEducation.topics.forEach((topic, idx) => {
      lines.push(`${idx + 1}. ${topic.topic || topic}`);
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
      lines.push(apptLine);
      if (appt.reason) lines.push(`   Reason: ${appt.reason}`);
    });
    lines.push('');
  }

  // Referrals
  if (doc.referrals && doc.referrals.length > 0) {
    lines.push('=== REFERRALS ===');
    doc.referrals.forEach((ref, idx) => {
      lines.push(`${idx + 1}. ${ref.specialty} - ${ref.reason}`);
      if (ref.status) lines.push(`   Status: ${ref.status}`);
      if (ref.urgency) lines.push(`   Urgency: ${ref.urgency}`);
    });
    lines.push('');
  }

  // Psychosocial Assessment
  if (doc.psychosocialAssessment) {
    lines.push('=== PSYCHOSOCIAL ASSESSMENT ===');
    const psa = doc.psychosocialAssessment;
    if (psa.anxietyLevel) lines.push(`Anxiety Level: ${psa.anxietyLevel}`);
    if (psa.stressors && psa.stressors.length > 0) {
      lines.push('Stressors:');
      psa.stressors.forEach(s => lines.push(`  • ${s}`));
    }
    if (psa.copingStrategies && psa.copingStrategies.length > 0) {
      lines.push('Coping Strategies:');
      psa.copingStrategies.forEach(c => lines.push(`  • ${c}`));
    }
    if (psa.supportSystems && psa.supportSystems.length > 0) {
      lines.push('Support Systems:');
      psa.supportSystems.forEach(s => lines.push(`  • ${s}`));
    }
    lines.push('');
  }

  // Prognosis
  if (doc.prognosis) {
    lines.push('=== PROGNOSIS ===');
    const prog = doc.prognosis;
    if (prog.shortTerm) lines.push(`Short-term: ${prog.shortTerm}`);
    if (prog.riskFactors && prog.riskFactors.length > 0) {
      lines.push('Risk Factors:');
      prog.riskFactors.forEach(rf => lines.push(`  • ${rf}`));
    }
    if (prog.protectiveFactors && prog.protectiveFactors.length > 0) {
      lines.push('Protective Factors:');
      prog.protectiveFactors.forEach(pf => lines.push(`  • ${pf}`));
    }
    lines.push('');
  }

  // Assessment and Plan
  if (doc.assessmentAndPlan) {
    lines.push('=== ASSESSMENT AND PLAN ===');
    lines.push(doc.assessmentAndPlan);
    lines.push('');
  }

  // Clinical Decision Support (AI-generated insights)
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
        lines.push(`  ${idx + 1}. ${flag.finding} (${flag.urgency})`);
        lines.push(`     Action: ${flag.action}`);
        if (flag.timeframe) lines.push(`     Timeframe: ${flag.timeframe}`);
      });
    }

    if (cds.drugInteractions && cds.drugInteractions.length > 0) {
      lines.push('\nDrug Interactions:');
      cds.drugInteractions.forEach((di, idx) => {
        lines.push(`  ${idx + 1}. ${di.medications.join(' + ')} (${di.severity})`);
        if (di.clinicalEffect) lines.push(`     Effect: ${di.clinicalEffect}`);
        if (di.mechanism) lines.push(`     Mechanism: ${di.mechanism}`);
        if (di.recommendation) lines.push(`     Recommendation: ${di.recommendation}`);
      });
    }

    if (cds.contraindications && cds.contraindications.length > 0) {
      lines.push('\nContraindications:');
      cds.contraindications.forEach((ci, idx) => {
        lines.push(`  ${idx + 1}. ${ci.medication} - ${ci.condition} (${ci.severity})`);
        if (ci.alternative) lines.push(`     Alternative: ${ci.alternative}`);
      });
    }
    lines.push('');
  }

  // Intelligent Recommendations (AI-generated)
  if (doc.intelligentRecommendations) {
    lines.push('=== INTELLIGENT RECOMMENDATIONS (AI-GENERATED) ===');
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
      lines.push('\nLong-term Recommendations:');
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
      lines.push('\nPreventive Measures:');
      ir.preventive.forEach((prev, idx) => {
        const prevText = typeof prev === 'string' ? prev : prev.screening;
        lines.push(`  ${idx + 1}. ${prevText}`);
        if (prev.indication) lines.push(`     Indication: ${prev.indication}`);
        if (prev.dueDate) lines.push(`     Due: ${prev.dueDate}`);
      });
    }
    lines.push('');
  }

  // Follow-up Intelligence (AI-generated)
  if (doc.followUpIntelligence) {
    lines.push('=== FOLLOW-UP INTELLIGENCE (AI-GENERATED) ===');
    const fi = doc.followUpIntelligence;

    if (fi.deadlines && fi.deadlines.length > 0) {
      lines.push('\nUpcoming Deadlines:');
      fi.deadlines.forEach((dl, idx) => {
        lines.push(`  ${idx + 1}. ${dl.item} - Due: ${dl.dueDate} (${dl.criticality})`);
        if (dl.consequences) lines.push(`     Consequences: ${dl.consequences}`);
        if (dl.autoSchedule) lines.push(`     Auto-schedule: Yes`);
      });
    }

    if (fi.prioritization && fi.prioritization.length > 0) {
      lines.push('\nPrioritization:');
      fi.prioritization.forEach((task, idx) => {
        lines.push(`  ${idx + 1}. ${task.task} (${task.urgency})`);
        if (task.importance) lines.push(`     Importance: ${task.importance}`);
        if (task.dependencies && task.dependencies.length > 0) {
          lines.push(`     Dependencies: ${task.dependencies.join(', ')}`);
        }
      });
    }

    if (fi.coordinationNeeds && fi.coordinationNeeds.length > 0) {
      lines.push('\nCoordination Needs:');
      fi.coordinationNeeds.forEach((coord, idx) => {
        lines.push(`  ${idx + 1}. ${coord.specialist} (${coord.urgency})`);
        if (coord.reason) lines.push(`     Reason: ${coord.reason}`);
        if (coord.informationNeeded && coord.informationNeeded.length > 0) {
          lines.push('     Information Needed:');
          coord.informationNeeded.forEach(info => lines.push(`       • ${info}`));
        }
      });
    }
    lines.push('');
  }

  // Additional Notes
  if (doc.additionalNotes) {
    lines.push('=== ADDITIONAL NOTES ===');
    lines.push(doc.additionalNotes);
    lines.push('');
  }

  // Providers and Care Team
  if (doc.providers || doc.careTeam) {
    lines.push('=== CARE TEAM ===');
    if (doc.providers && doc.providers.primary) {
      lines.push(`Primary: ${doc.providers.primary}${doc.providers.primarySpecialty ? ` (${doc.providers.primarySpecialty})` : ''}`);
    }
    if (doc.careTeam && doc.careTeam.length > 0) {
      lines.push('\nTeam Members:');
      doc.careTeam.forEach((member, idx) => {
        lines.push(`  ${idx + 1}. ${member.name} - ${member.specialty} (${member.role})`);
      });
    }
    lines.push('');
  }

  return lines.join('\n');
};
