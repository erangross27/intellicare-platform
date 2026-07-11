// Service proxy for lazy loading (prevents circular dependencies)
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

/**
 * Insurance Service
 * Provides comprehensive insurance coverage checking for Israeli health funds (Kupot Cholim)
 * and US insurance providers
 */

class InsuranceService {
  constructor() {
    this.initialized = false;
    // Israeli Health Funds (Kupot Cholim) Coverage Rules
    this.israeliHealthFunds = {
      clalit: {
        name: 'כללית',
        englishName: 'Clalit',
        coverageRules: {
          medications: {
            basketDrugs: { coverage: 100, copay: 18, notes: 'תרופות בסל הבריאות' },
            genericDrugs: { coverage: 90, copay: 18, notes: 'תרופות גנריות' },
            brandDrugs: { coverage: 50, copay: 36, notes: 'תרופות מותג כשיש גנרי' },
            offLabel: { coverage: 0, copay: 'full', notes: 'שימוש off-label' },
            experimental: { coverage: 0, copay: 'full', notes: 'תרופות ניסיוניות' }
          },
          services: {
            primaryCare: { coverage: 100, copay: 0, quarterlyLimit: 999 },
            specialist: { coverage: 75, copay: 28, quarterlyLimit: 3 },
            emergency: { coverage: 100, copay: 0, notes: 'מצבי חירום' },
            labTests: { coverage: 100, copay: 0, notes: 'בדיקות בסיסיות' },
            imaging: {
              xray: { coverage: 100, copay: 0 },
              ultrasound: { coverage: 100, copay: 35 },
              ct: { coverage: 75, copay: 91 },
              mri: { coverage: 75, copay: 133, requiresApproval: true }
            }
          },
          supplementalPlans: ['כללית מושלם', 'כללית פלטינום']
        }
      },
      maccabi: {
        name: 'מכבי',
        englishName: 'Maccabi',
        coverageRules: {
          medications: {
            basketDrugs: { coverage: 100, copay: 15, notes: 'תרופות בסל הבריאות' },
            genericDrugs: { coverage: 90, copay: 15, notes: 'תרופות גנריות' },
            brandDrugs: { coverage: 60, copay: 30, notes: 'תרופות מותג' },
            offLabel: { coverage: 0, copay: 'full', notes: 'שימוש off-label' },
            experimental: { coverage: 0, copay: 'full', notes: 'תרופות ניסיוניות' }
          },
          services: {
            primaryCare: { coverage: 100, copay: 0, quarterlyLimit: 999 },
            specialist: { coverage: 80, copay: 25, quarterlyLimit: 4 },
            emergency: { coverage: 100, copay: 0 },
            labTests: { coverage: 100, copay: 0 },
            imaging: {
              xray: { coverage: 100, copay: 0 },
              ultrasound: { coverage: 100, copay: 30 },
              ct: { coverage: 80, copay: 85 },
              mri: { coverage: 80, copay: 120, requiresApproval: true }
            }
          },
          supplementalPlans: ['מכבי זהב', 'מכבי שלי']
        }
      },
      meuhedet: {
        name: 'מאוחדת',
        englishName: 'Meuhedet',
        coverageRules: {
          medications: {
            basketDrugs: { coverage: 100, copay: 17, notes: 'תרופות בסל הבריאות' },
            genericDrugs: { coverage: 85, copay: 17, notes: 'תרופות גנריות' },
            brandDrugs: { coverage: 55, copay: 34, notes: 'תרופות מותג' },
            offLabel: { coverage: 0, copay: 'full', notes: 'שימוש off-label' },
            experimental: { coverage: 0, copay: 'full', notes: 'תרופות ניסיוניות' }
          },
          services: {
            primaryCare: { coverage: 100, copay: 0, quarterlyLimit: 999 },
            specialist: { coverage: 70, copay: 32, quarterlyLimit: 3 },
            emergency: { coverage: 100, copay: 0 },
            labTests: { coverage: 100, copay: 0 },
            imaging: {
              xray: { coverage: 100, copay: 0 },
              ultrasound: { coverage: 100, copay: 38 },
              ct: { coverage: 70, copay: 95 },
              mri: { coverage: 70, copay: 140, requiresApproval: true }
            }
          },
          supplementalPlans: ['מאוחדת עדיף', 'מאוחדת שיא']
        }
      },
      leumit: {
        name: 'לאומית',
        englishName: 'Leumit',
        coverageRules: {
          medications: {
            basketDrugs: { coverage: 100, copay: 16, notes: 'תרופות בסל הבריאות' },
            genericDrugs: { coverage: 85, copay: 16, notes: 'תרופות גנריות' },
            brandDrugs: { coverage: 50, copay: 32, notes: 'תרופות מותג' },
            offLabel: { coverage: 0, copay: 'full', notes: 'שימוש off-label' },
            experimental: { coverage: 0, copay: 'full', notes: 'תרופות ניסיוניות' }
          },
          services: {
            primaryCare: { coverage: 100, copay: 0, quarterlyLimit: 999 },
            specialist: { coverage: 70, copay: 30, quarterlyLimit: 3 },
            emergency: { coverage: 100, copay: 0 },
            labTests: { coverage: 100, copay: 0 },
            imaging: {
              xray: { coverage: 100, copay: 0 },
              ultrasound: { coverage: 100, copay: 35 },
              ct: { coverage: 70, copay: 90 },
              mri: { coverage: 70, copay: 135, requiresApproval: true }
            }
          },
          supplementalPlans: ['לאומית זהב', 'לאומית כסף']
        }
      }
    };

    // Israeli National Health Basket (Sal Habriut)
    this.healthBasketMedications = {
      // Common chronic disease medications
      diabetes: ['metformin', 'glibenclamide', 'insulin', 'sitagliptin'],
      hypertension: ['amlodipine', 'enalapril', 'lisinopril', 'losartan', 'atenolol'],
      cholesterol: ['simvastatin', 'atorvastatin', 'rosuvastatin'],
      mental: ['sertraline', 'escitalopram', 'fluoxetine', 'risperidone'],
      antibiotics: ['amoxicillin', 'azithromycin', 'ciprofloxacin', 'ceftriaxone'],
      pain: ['paracetamol', 'ibuprofen', 'tramadol', 'morphine'],
      asthma: ['salbutamol', 'budesonide', 'montelukast']
    };

    // Prior authorization requirements
    this.priorAuthRequirements = {
      medications: {
        biological: ['adalimumab', 'etanercept', 'infliximab', 'rituximab'],
        oncology: ['pembrolizumab', 'nivolumab', 'bevacizumab'],
        specialty: ['sofosbuvir', 'ledipasvir', 'daclatasvir'],
        highCost: ['tafamidis', 'nusinersen', 'eculizumab']
      },
      procedures: {
        imaging: ['mri', 'pet', 'petct'],
        surgery: ['bariatric', 'cosmetic', 'experimental'],
        therapy: ['physical_therapy_extended', 'psychological_extended']
      },
      criteria: {
        biological: 'Failed conventional therapy for 3 months',
        oncology: 'Specific cancer type and stage',
        mri: 'Conservative treatment failed',
        bariatric: 'BMI > 35 with comorbidities or BMI > 40'
      }
    };

    // US Insurance (simplified example)
    this.usInsurance = {
      medicare: {
        partA: {
          hospital: { coverage: 100, deductible: 1632, notes: 'Inpatient hospital' },
          skilledNursing: { coverage: 100, days: 20, copayAfter: 200 }
        },
        partB: {
          doctorVisits: { coverage: 80, deductible: 226 },
          labTests: { coverage: 100, notes: 'Diagnostic tests' },
          preventive: { coverage: 100, notes: 'Annual wellness visit' }
        },
        partD: {
          genericDrugs: { coverage: 75, copay: 10 },
          brandDrugs: { coverage: 50, copay: 47 },
          specialtyDrugs: { coverage: 25, copay: 'percentage' }
        }
      },
      privatePPO: {
        inNetwork: {
          primaryCare: { coverage: 90, copay: 20 },
          specialist: { coverage: 80, copay: 40 },
          emergency: { coverage: 80, copay: 350 },
          hospital: { coverage: 80, deductible: 500 }
        },
        outOfNetwork: {
          primaryCare: { coverage: 60, deductible: 1000 },
          specialist: { coverage: 60, deductible: 1000 },
          emergency: { coverage: 60, copay: 350 },
          hospital: { coverage: 60, deductible: 2000 }
        },
        prescription: {
          tier1: { copay: 10, notes: 'Generic' },
          tier2: { copay: 30, notes: 'Preferred brand' },
          tier3: { copay: 60, notes: 'Non-preferred brand' },
          tier4: { copay: '30%', notes: 'Specialty' }
        }
      }
    };
  }
  
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Authenticate service with serviceAccountManager
      this.serviceToken = await serviceAccountManager.authenticate('insurance-service');
      
      // Initialize secure config service
      await secureConfigService.initialize();
      
      // Set initialized flag
      this.initialized = true;
      
      // Log initialization using secureDataAccess
      const context = {
        serviceId: 'insurance-service',
        operation: 'initialize-service',
        practiceId: 'global'
      };
      
      await secureDataAccess.create('audit_logs', {
        action: 'SERVICE_INITIALIZED',
        service: 'insurance-service',
        timestamp: new Date()
      }, context);
      
      return this;
    } catch (error) {
      throw new Error(`Failed to initialize InsuranceService: ${error.message}`);
    }
  }


  /**
   * Main coverage checking function
   */
  checkCoverage(insuranceInfo, service, medication = null, language = 'en') {
    const isHebrew = language === 'he';
    const result = {
      covered: false,
      coveragePercentage: 0,
      copayAmount: 0,
      requiresPriorAuth: false,
      notes: [],
      alternatives: [],
      appealProcess: null
    };

    // Determine country and insurance type
    const { provider, plan, country } = insuranceInfo;
    
    if (country === 'Israel' || this.isIsraeliProvider(provider)) {
      return this.checkIsraeliCoverage(provider, plan, service, medication, isHebrew);
    } else {
      return this.checkUSCoverage(provider, plan, service, medication, isHebrew);
    }
  }

  /**
   * Check Israeli health fund coverage
   */
  checkIsraeliCoverage(fundName, plan, service, medication, isHebrew) {
    const fund = this.getIsraeliFund(fundName);
    if (!fund) {
      return {
        error: isHebrew 
          ? 'קופת חולים לא מזוהה'
          : 'Health fund not recognized'
      };
    }

    const result = {
      fund: fund.name,
      fundEnglish: fund.englishName,
      covered: false,
      coveragePercentage: 0,
      copayAmount: 0,
      requiresPriorAuth: false,
      notes: [],
      alternatives: []
    };

    // Check medication coverage
    if (medication) {
      const medCoverage = this.checkMedicationCoverage(medication, fund, isHebrew);
      Object.assign(result, medCoverage);
      
      // Check if medication is in health basket
      if (this.isInHealthBasket(medication)) {
        result.inBasket = true;
        result.notes.push(isHebrew
          ? 'תרופה בסל הבריאות - זכאות מלאה'
          : 'Medication in health basket - Full eligibility'
        );
      }
      
      // Check prior authorization
      if (this.requiresPriorAuth(medication)) {
        result.requiresPriorAuth = true;
        result.priorAuthCriteria = this.getPriorAuthCriteria(medication, isHebrew);
      }
    }

    // Check service coverage
    if (service) {
      const serviceCoverage = this.checkServiceCoverage(service, fund, plan, isHebrew);
      Object.assign(result, serviceCoverage);
    }

    // Add supplemental plan benefits
    if (plan && fund.coverageRules.supplementalPlans.includes(plan)) {
      result.supplementalBenefits = this.getSupplementalBenefits(fund, plan, isHebrew);
    }

    return result;
  }

  /**
   * Check medication coverage
   */
  checkMedicationCoverage(medication, fund, isHebrew) {
    const normalizedMed = medication.toLowerCase();
    const rules = fund.coverageRules.medications;
    
    // Check if in health basket
    if (this.isInHealthBasket(normalizedMed)) {
      return {
        covered: true,
        coveragePercentage: rules.basketDrugs.coverage,
        copayAmount: rules.basketDrugs.copay,
        category: 'basketDrug',
        notes: [isHebrew ? rules.basketDrugs.notes : 'Health basket medication']
      };
    }
    
    // Check if generic available
    if (this.hasGenericVersion(normalizedMed)) {
      return {
        covered: true,
        coveragePercentage: rules.genericDrugs.coverage,
        copayAmount: rules.genericDrugs.copay,
        category: 'generic',
        notes: [isHebrew ? 'יש גרסה גנרית זולה יותר' : 'Generic version available'],
        alternatives: [this.getGenericName(normalizedMed)]
      };
    }
    
    // Brand drug
    return {
      covered: true,
      coveragePercentage: rules.brandDrugs.coverage,
      copayAmount: rules.brandDrugs.copay,
      category: 'brand',
      notes: [isHebrew ? 'תרופת מותג - השתתפות גבוהה' : 'Brand medication - Higher copay']
    };
  }

  /**
   * Check service coverage
   */
  checkServiceCoverage(service, fund, plan, isHebrew) {
    const rules = fund.coverageRules.services;
    const normalizedService = service.toLowerCase().replace(/[^a-z]/g, '');
    
    // Primary care
    if (normalizedService.includes('primary') || normalizedService.includes('gp')) {
      return {
        covered: true,
        coveragePercentage: rules.primaryCare.coverage,
        copayAmount: rules.primaryCare.copay,
        quarterlyLimit: rules.primaryCare.quarterlyLimit,
        notes: [isHebrew ? 'רופא משפחה - ללא השתתפות' : 'Primary care - No copay']
      };
    }
    
    // Specialist
    if (normalizedService.includes('specialist') || normalizedService.includes('expert')) {
      return {
        covered: true,
        coveragePercentage: rules.specialist.coverage,
        copayAmount: rules.specialist.copay,
        quarterlyLimit: rules.specialist.quarterlyLimit,
        notes: [isHebrew 
          ? `מומחה - השתתפות ${rules.specialist.copay} ש"ח`
          : `Specialist - ${rules.specialist.copay} NIS copay`
        ]
      };
    }
    
    // Imaging
    if (normalizedService.includes('mri')) {
      return {
        covered: true,
        coveragePercentage: rules.imaging.mri.coverage,
        copayAmount: rules.imaging.mri.copay,
        requiresPriorAuth: rules.imaging.mri.requiresApproval,
        notes: [isHebrew 
          ? 'MRI - נדרש אישור מראש'
          : 'MRI - Prior approval required'
        ]
      };
    }
    
    if (normalizedService.includes('ct')) {
      return {
        covered: true,
        coveragePercentage: rules.imaging.ct.coverage,
        copayAmount: rules.imaging.ct.copay,
        notes: [isHebrew ? 'CT - השתתפות חלקית' : 'CT scan - Partial copay']
      };
    }
    
    if (normalizedService.includes('xray')) {
      return {
        covered: true,
        coveragePercentage: rules.imaging.xray.coverage,
        copayAmount: rules.imaging.xray.copay,
        notes: [isHebrew ? 'צילום רנטגן - ללא השתתפות' : 'X-ray - No copay']
      };
    }
    
    // Lab tests
    if (normalizedService.includes('lab') || normalizedService.includes('blood')) {
      return {
        covered: true,
        coveragePercentage: rules.labTests.coverage,
        copayAmount: rules.labTests.copay,
        notes: [isHebrew ? 'בדיקות מעבדה - ללא השתתפות' : 'Lab tests - No copay']
      };
    }
    
    // Emergency
    if (normalizedService.includes('emergency') || normalizedService.includes('urgent')) {
      return {
        covered: true,
        coveragePercentage: rules.emergency.coverage,
        copayAmount: rules.emergency.copay,
        notes: [isHebrew ? 'חדר מיון - ללא השתתפות' : 'Emergency room - No copay']
      };
    }
    
    // Default
    return {
      covered: false,
      notes: [isHebrew 
        ? 'שירות לא מזוהה - יש לבדוק עם הקופה'
        : 'Service not recognized - Check with insurance'
      ]
    };
  }

  /**
   * Check US insurance coverage
   */
  checkUSCoverage(provider, plan, service, medication, isHebrew) {
    // Simplified US coverage check
    const result = {
      provider: provider,
      plan: plan,
      covered: false,
      coveragePercentage: 0,
      copayAmount: 0,
      deductible: 0,
      notes: []
    };
    
    if (provider.toLowerCase().includes('medicare')) {
      if (medication) {
        const partD = this.usInsurance.medicare.partD;
        if (this.isGeneric(medication)) {
          result.covered = true;
          result.coveragePercentage = partD.genericDrugs.coverage;
          result.copayAmount = partD.genericDrugs.copay;
          result.notes.push('Medicare Part D - Generic drug coverage');
        } else {
          result.covered = true;
          result.coveragePercentage = partD.brandDrugs.coverage;
          result.copayAmount = partD.brandDrugs.copay;
          result.notes.push('Medicare Part D - Brand drug coverage');
        }
      }
      
      if (service) {
        const partB = this.usInsurance.medicare.partB;
        result.covered = true;
        result.coveragePercentage = partB.doctorVisits.coverage;
        result.deductible = partB.doctorVisits.deductible;
        result.notes.push('Medicare Part B - 80% coverage after deductible');
      }
    } else {
      // Private insurance
      const ppo = this.usInsurance.privatePPO;
      if (service) {
        const inNetwork = ppo.inNetwork;
        if (service.toLowerCase().includes('primary')) {
          result.covered = true;
          result.coveragePercentage = inNetwork.primaryCare.coverage;
          result.copayAmount = inNetwork.primaryCare.copay;
        } else if (service.toLowerCase().includes('specialist')) {
          result.covered = true;
          result.coveragePercentage = inNetwork.specialist.coverage;
          result.copayAmount = inNetwork.specialist.copay;
        }
      }
      
      if (medication) {
        const rx = ppo.prescription;
        if (this.isGeneric(medication)) {
          result.covered = true;
          result.copayAmount = rx.tier1.copay;
          result.notes.push(rx.tier1.notes);
        } else {
          result.covered = true;
          result.copayAmount = rx.tier2.copay;
          result.notes.push(rx.tier2.notes);
        }
      }
    }
    
    return result;
  }

  /**
   * Calculate total out-of-pocket cost
   */
  calculateOutOfPocket(coverageInfo, totalCost, language = 'en') {
    const isHebrew = language === 'he';
    
    if (!coverageInfo.covered) {
      return {
        amount: totalCost,
        breakdown: isHebrew ? 'לא מכוסה - תשלום מלא' : 'Not covered - Full payment',
        savingsTip: null
      };
    }
    
    const coveredAmount = (totalCost * coverageInfo.coveragePercentage) / 100;
    const patientResponsibility = totalCost - coveredAmount + coverageInfo.copayAmount;
    
    const result = {
      amount: Math.round(patientResponsibility * 100) / 100,
      breakdown: {
        totalCost: totalCost,
        insurancePays: coveredAmount,
        copay: coverageInfo.copayAmount,
        coinsurance: totalCost - coveredAmount,
        deductible: coverageInfo.deductible || 0
      }
    };
    
    // Add savings tips
    if (coverageInfo.alternatives && coverageInfo.alternatives.length > 0) {
      result.savingsTip = isHebrew
        ? `שקול להשתמש ב-${coverageInfo.alternatives[0]} לחיסכון`
        : `Consider using ${coverageInfo.alternatives[0]} to save money`;
    }
    
    return result;
  }

  /**
   * Get prior authorization requirements
   */
  getPriorAuthRequirements(medication, insuranceInfo, language = 'en') {
    const isHebrew = language === 'he';
    
    if (!this.requiresPriorAuth(medication)) {
      return { required: false };
    }
    
    const requirements = {
      required: true,
      criteria: [],
      documents: [],
      timeframe: isHebrew ? '3-5 ימי עסקים' : '3-5 business days',
      process: []
    };
    
    // Get specific criteria
    const medClass = this.getMedicationClass(medication);
    const criteria = this.priorAuthRequirements.criteria[medClass];
    
    if (criteria) {
      requirements.criteria.push(criteria);
    }
    
    // Required documents
    requirements.documents = isHebrew ? [
      'מכתב מרופא מומחה',
      'תיעוד כישלון טיפול קודם',
      'תוצאות בדיקות רלוונטיות',
      'היסטוריה רפואית'
    ] : [
      'Specialist letter',
      'Failed therapy documentation',
      'Relevant test results',
      'Medical history'
    ];
    
    // Process steps
    requirements.process = isHebrew ? [
      'הרופא מגיש בקשה לקופה',
      'ועדה רפואית בוחנת את הבקשה',
      'תשובה תוך 3-5 ימים',
      'אפשרות לערעור במקרה של דחייה'
    ] : [
      'Doctor submits request to insurance',
      'Medical committee reviews request',
      'Response within 3-5 days',
      'Appeal option if denied'
    ];
    
    return requirements;
  }

  /**
   * Get appeal process information
   */
  getAppealProcess(denialReason, insuranceInfo, language = 'en') {
    const isHebrew = language === 'he';
    
    return {
      steps: isHebrew ? [
        'קבל את מכתב הדחייה בכתב',
        'התייעץ עם הרופא המטפל',
        'אסוף מסמכים תומכים נוספים',
        'הגש ערעור תוך 30 יום',
        'המתן לתשובה (עד 30 יום)',
        'אפשרות לערעור נוסף או פנייה לבית הדין'
      ] : [
        'Get denial letter in writing',
        'Consult with treating physician',
        'Gather additional supporting documents',
        'Submit appeal within 30 days',
        'Wait for response (up to 30 days)',
        'Option for second appeal or tribunal'
      ],
      
      supportingDocuments: isHebrew ? [
        'מכתב רופא מפורט',
        'ספרות רפואית תומכת',
        'חוות דעת מומחה נוסף',
        'תיעוד תופעות לוואי מטיפולים אחרים'
      ] : [
        'Detailed physician letter',
        'Supporting medical literature',
        'Second specialist opinion',
        'Documentation of side effects from other treatments'
      ],
      
      successTips: isHebrew ? [
        'הדגש את הצורך הרפואי הייחודי',
        'צרף עדויות קליניות',
        'ציין כישלון טיפולים קודמים',
        'הסבר למה אין חלופה מתאימה'
      ] : [
        'Emphasize unique medical necessity',
        'Include clinical evidence',
        'Document failed previous treatments',
        'Explain why no suitable alternative exists'
      ]
    };
  }

  /**
   * Helper: Check if medication is in health basket
   */
  isInHealthBasket(medication) {
    const normalized = medication.toLowerCase();
    for (const category of Object.values(this.healthBasketMedications)) {
      if (category.some(med => normalized.includes(med))) {
        return true;
      }
    }
    return false;
  }

  /**
   * Helper: Check if requires prior authorization
   */
  requiresPriorAuth(medication) {
    const normalized = medication.toLowerCase();
    for (const category of Object.values(this.priorAuthRequirements.medications)) {
      if (category.some(med => normalized.includes(med))) {
        return true;
      }
    }
    return false;
  }

  /**
   * Helper: Get prior auth criteria
   */
  getPriorAuthCriteria(medication, isHebrew) {
    const normalized = medication.toLowerCase();
    
    for (const [category, meds] of Object.entries(this.priorAuthRequirements.medications)) {
      if (meds.some(med => normalized.includes(med))) {
        const criteria = this.priorAuthRequirements.criteria[category];
        return isHebrew ? this.translateCriteria(criteria) : criteria;
      }
    }
    
    return isHebrew ? 'קריטריונים ספציפיים נדרשים' : 'Specific criteria required';
  }

  /**
   * Helper: Translate criteria to Hebrew
   */
  translateCriteria(criteria) {
    const translations = {
      'Failed conventional therapy for 3 months': 'כישלון טיפול קונבנציונלי למשך 3 חודשים',
      'Specific cancer type and stage': 'סוג וש לב סרטן ספציפי',
      'Conservative treatment failed': 'כישלון טיפול שמרני',
      'BMI > 35 with comorbidities or BMI > 40': 'BMI > 35 עם מחלות נלוות או BMI > 40'
    };
    
    return translations[criteria] || criteria;
  }

  /**
   * Helper: Get Israeli fund
   */
  getIsraeliFund(fundName) {
    const normalized = fundName.toLowerCase();
    
    if (normalized.includes('clalit') || normalized.includes('כללית')) {
      return this.israeliHealthFunds.clalit;
    }
    if (normalized.includes('maccabi') || normalized.includes('מכבי')) {
      return this.israeliHealthFunds.maccabi;
    }
    if (normalized.includes('meuhedet') || normalized.includes('מאוחדת')) {
      return this.israeliHealthFunds.meuhedet;
    }
    if (normalized.includes('leumit') || normalized.includes('לאומית')) {
      return this.israeliHealthFunds.leumit;
    }
    
    return null;
  }

  /**
   * Helper: Check if Israeli provider
   */
  isIsraeliProvider(provider) {
    const israeliProviders = ['clalit', 'maccabi', 'meuhedet', 'leumit', 'כללית', 'מכבי', 'מאוחדת', 'לאומית'];
    return israeliProviders.some(p => provider.toLowerCase().includes(p));
  }

  /**
   * Helper: Check if generic
   */
  isGeneric(medication) {
    // Simplified check - in reality would check against database
    const genericIndicators = ['generic', 'גנרי'];
    return genericIndicators.some(ind => medication.toLowerCase().includes(ind));
  }

  /**
   * Helper: Check if has generic version
   */
  hasGenericVersion(medication) {
    // Common brand to generic mappings
    const brandToGeneric = {
      'lipitor': 'atorvastatin',
      'zocor': 'simvastatin',
      'plavix': 'clopidogrel',
      'nexium': 'esomeprazole',
      'advair': 'fluticasone/salmeterol'
    };
    
    return Object.keys(brandToGeneric).some(brand => 
      medication.toLowerCase().includes(brand)
    );
  }

  /**
   * Helper: Get generic name
   */
  getGenericName(brandName) {
    const brandToGeneric = {
      'lipitor': 'atorvastatin',
      'zocor': 'simvastatin',
      'plavix': 'clopidogrel',
      'nexium': 'esomeprazole',
      'advair': 'fluticasone/salmeterol'
    };
    
    const normalized = brandName.toLowerCase();
    for (const [brand, generic] of Object.entries(brandToGeneric)) {
      if (normalized.includes(brand)) {
        return generic;
      }
    }
    
    return brandName + ' (generic)';
  }

  /**
   * Helper: Get medication class
   */
  getMedicationClass(medication) {
    const normalized = medication.toLowerCase();
    
    if (this.priorAuthRequirements.medications.biological.some(m => normalized.includes(m))) {
      return 'biological';
    }
    if (this.priorAuthRequirements.medications.oncology.some(m => normalized.includes(m))) {
      return 'oncology';
    }
    if (this.priorAuthRequirements.medications.specialty.some(m => normalized.includes(m))) {
      return 'specialty';
    }
    
    return 'standard';
  }

  /**
   * Get supplemental plan benefits
   */
  getSupplementalBenefits(fund, plan, isHebrew) {
    // Simplified supplemental benefits
    return {
      additionalServices: isHebrew ? [
        'ייעוצים עם מומחים ללא הגבלה',
        'ניתוחים פרטיים בארץ',
        'חוות דעת שנייה',
        'רפואה משלימה'
      ] : [
        'Unlimited specialist consultations',
        'Private surgeries in Israel',
        'Second opinion',
        'Complementary medicine'
      ],
      reducedCopays: true,
      travelInsurance: true
    };
  }
}

// Register with ServiceProxy for lazy loading
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('insuranceService', () => {
    return module.exports;
  });
}

module.exports = new InsuranceService();