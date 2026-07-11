/**
 * Allergy Checker Service - Clinical Care Domain
 * Uses Gemini AI for comprehensive allergy checking including cross-sensitivity detection,
 * severity classification, and alternative medication suggestions
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const geminiMedicalService = require('../../../../../../backend/services/geminiMedicalService');
const serviceAccountManager = require('../../../../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../../../../backend/services/secureDataAccess');

export interface AllergyCheckOptions {
  language?: 'en' | 'he';
  patientContext?: Record<string, any>;
}

export interface AllergyResult {
  safe: boolean;
  directAllergy: boolean;
  crossSensitivity: CrossSensitivityInfo[];
  severity: string | null;
  alternatives: AlternativeMedication[];
  recommendations: Recommendation[];
  warnings: Warning[];
  explanation?: string;
  mechanism?: string;
  clinicalPearls?: string[];
  patientEducation?: string;
}

export interface CrossSensitivityInfo {
  allergen: string;
  medication: string;
  risk: 'none' | 'low' | 'moderate' | 'high' | 'very low';
  rate: string;
  mechanism: string;
}

export interface AlternativeMedication {
  medication: string;
  class: string;
  notes: string;
}

export interface Recommendation {
  priority: 'critical' | 'high' | 'medium' | 'low' | 'routine';
  action: string;
  alternatives?: boolean;
}

export interface Warning {
  type: string;
  message: string;
  severity: string;
}

@Injectable()
export class AllergyCheckerService {
  private initialized = false;
  private serviceToken: any;
  
  // Fallback cross-sensitivity database (for when API is unavailable)
  private crossSensitivities = {
    // Beta-lactam antibiotics
    'penicillin': {
      highRisk: ['ampicillin', 'amoxicillin', 'piperacillin', 'ticarcillin', 'nafcillin', 'oxacillin'],
      moderateRisk: ['cephalexin', 'cefazolin', 'cefuroxime', 'ceftriaxone', 'cefotaxime'],
      lowRisk: ['cefepime', 'ceftaroline', 'aztreonam'],
      veryLowRisk: ['meropenem', 'imipenem', 'ertapenem'],
      crossReactivityRate: {
        cephalosporins: '5-10%',
        carbapenems: '<1%',
        monobactams: '<1%'
      }
    },
    'cephalosporin': {
      highRisk: ['cefazolin', 'cephalexin', 'cefuroxime', 'ceftriaxone'],
      moderateRisk: ['penicillin', 'amoxicillin', 'ampicillin'],
      lowRisk: ['aztreonam', 'meropenem'],
      crossReactivityRate: {
        penicillins: '5-10%',
        carbapenems: '<1%'
      }
    },
    
    // Sulfa drugs
    'sulfonamide': {
      highRisk: ['sulfamethoxazole', 'sulfadiazine', 'sulfasalazine'],
      moderateRisk: ['furosemide', 'bumetanide', 'hydrochlorothiazide', 'acetazolamide'],
      lowRisk: ['celecoxib', 'sumatriptan'],
      nonSulfa: ['dapsone', 'sulfonylureas'],
      crossReactivityRate: {
        loopDiuretics: '10%',
        thiazides: '10%',
        sulfonylureas: '<1%'
      }
    },
    
    // NSAIDs
    'aspirin': {
      highRisk: ['ibuprofen', 'naproxen', 'diclofenac', 'indomethacin', 'ketorolac'],
      moderateRisk: ['celecoxib', 'meloxicam'],
      lowRisk: ['acetaminophen', 'tramadol'],
      mechanism: 'COX inhibition',
      crossReactivityRate: {
        nsaids: '5-10%',
        cox2: '2-5%'
      }
    },
    'ibuprofen': {
      highRisk: ['naproxen', 'diclofenac', 'ketorolac', 'indomethacin'],
      moderateRisk: ['aspirin', 'celecoxib'],
      lowRisk: ['acetaminophen', 'tramadol'],
      crossReactivityRate: {
        otherNsaids: '5-10%',
        aspirin: '5%'
      }
    },
    
    // Opioids
    'morphine': {
      highRisk: ['codeine', 'hydrocodone', 'oxycodone'],
      moderateRisk: ['fentanyl', 'hydromorphone'],
      lowRisk: ['tramadol', 'meperidine'],
      mechanism: 'Histamine release',
      crossReactivityRate: {
        naturalOpioids: 'High',
        syntheticOpioids: 'Low'
      }
    },
    'codeine': {
      highRisk: ['morphine', 'hydrocodone'],
      moderateRisk: ['oxycodone', 'hydromorphone'],
      lowRisk: ['fentanyl', 'tramadol'],
      crossReactivityRate: {
        morphine: 'High',
        synthetic: 'Low'
      }
    },
    
    // Local anesthetics
    'lidocaine': {
      highRisk: ['bupivacaine', 'mepivacaine', 'prilocaine'],
      lowRisk: ['benzocaine', 'procaine', 'tetracaine'],
      mechanism: 'Amide vs Ester',
      crossReactivityRate: {
        amides: 'Rare',
        esters: 'None'
      }
    },
    'benzocaine': {
      highRisk: ['procaine', 'tetracaine'],
      lowRisk: ['lidocaine', 'bupivacaine', 'mepivacaine'],
      crossReactivityRate: {
        esters: 'Common',
        amides: 'None'
      }
    },
    
    // Contrast media
    'iodine': {
      highRisk: ['iopamidol', 'iohexol', 'iopromide', 'ioversol'],
      moderateRisk: ['shellfish', 'povidone-iodine'],
      lowRisk: ['gadolinium'],
      note: 'Shellfish allergy does NOT predict contrast allergy',
      crossReactivityRate: {
        contrastMedia: 'Variable',
        shellfish: 'No correlation'
      }
    },
    
    // Latex
    'latex': {
      foodCrossSensitivity: ['banana', 'avocado', 'kiwi', 'chestnut', 'papaya', 'potato', 'tomato'],
      medicalProducts: ['gloves', 'catheters', 'tourniquets', 'adhesive tape', 'elastic bandages'],
      alternatives: ['nitrile', 'vinyl', 'neoprene'],
      crossReactivityRate: {
        fruits: '30-50%',
        medicalProducts: 'High'
      }
    },
    
    // Egg allergy (vaccines)
    'egg': {
      vaccines: {
        contraindicated: [],  // No longer contraindicated for any vaccine
        caution: ['influenza', 'yellow fever'],
        safe: ['mmr', 'varicella', 'hepatitis', 'covid-19']
      },
      medications: ['propofol', 'some vaccines'],
      crossReactivityRate: {
        influenzaVaccine: '<1%',
        mmr: 'None'
      }
    }
  };

  // Severity classifications
  private severityLevels = {
    mild: {
      symptoms: ['rash', 'itching', 'hives', 'mild swelling'],
      management: 'Antihistamines, discontinue if possible'
    },
    moderate: {
      symptoms: ['widespread rash', 'facial swelling', 'wheezing', 'nausea'],
      management: 'Antihistamines, corticosteroids, monitor closely'
    },
    severe: {
      symptoms: ['angioedema', 'bronchospasm', 'hypotension', 'severe dyspnea'],
      management: 'Immediate discontinuation, IV antihistamines, corticosteroids'
    },
    anaphylaxis: {
      symptoms: ['airway compromise', 'cardiovascular collapse', 'multi-organ involvement'],
      management: 'Epinephrine IM, IV fluids, airway management, ICU'
    }
  };

  // Alternative medications by class
  private alternatives = {
    antibiotics: {
      'penicillin_allergy': ['azithromycin', 'clarithromycin', 'levofloxacin', 'doxycycline', 'trimethoprim-sulfamethoxazole'],
      'cephalosporin_allergy': ['azithromycin', 'levofloxacin', 'doxycycline', 'gentamicin'],
      'sulfa_allergy': ['penicillin', 'cephalosporin', 'azithromycin', 'levofloxacin'],
      'fluoroquinolone_allergy': ['azithromycin', 'doxycycline', 'penicillin', 'cephalosporin']
    },
    painRelief: {
      'nsaid_allergy': ['acetaminophen', 'tramadol', 'opioids', 'topical analgesics'],
      'opioid_allergy': ['acetaminophen', 'nsaids', 'gabapentin', 'pregabalin'],
      'acetaminophen_allergy': ['nsaids', 'tramadol', 'topical analgesics']
    },
    anesthesia: {
      'lidocaine_allergy': ['bupivacaine', 'procaine', 'benzocaine'],
      'ester_allergy': ['lidocaine', 'bupivacaine', 'mepivacaine'],
      'amide_allergy': ['procaine', 'benzocaine', 'tetracaine']
    }
  };

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    if (this.initialized) return;
    
    try {
      // Authenticate service with serviceAccountManager
      this.serviceToken = await serviceAccountManager.authenticate('allergy-checker-service');
      
      // Set initialized flag
      this.initialized = true;
      
      // Log initialization using SecureDataAccess
      const context = {
        serviceId: 'allergy-checker-service',
        operation: 'service_initialization',
        clinicId: 'global'
      };
      
      await SecureDataAccess.insert('audit_logs', {
        action: 'SERVICE_INITIALIZED',
        service: 'allergyCheckerService',
        timestamp: new Date()
      }, {
        ...context,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      });
      
    } catch (error) {
      throw new Error(`Failed to initialize AllergyCheckerService: ${error.message}`);
    }
  }

  /**
   * Main allergy checking function - uses Gemini AI
   */
  async checkAllergies(
    patientAllergies: any[], 
    proposedMedication: string, 
    options: AllergyCheckOptions = {}
  ): Promise<AllergyResult> {
    const { language = 'en', patientContext = {} } = options;
    const isHebrew = language === 'he';
    
    if (!this.initialized) {
      await this.onModuleInit();
    }
    
    try {
      // Use Gemini AI for allergy checking
      const geminiResult = await geminiMedicalService.checkAllergies(
        proposedMedication,
        patientAllergies,
        patientContext
      );
      
      // Format the Gemini response to match our expected structure
      const result: AllergyResult = {
        safe: geminiResult.isSafe,
        directAllergy: geminiResult.directAllergy,
        crossSensitivity: geminiResult.crossSensitivities || [],
        severity: geminiResult.riskLevel,
        alternatives: geminiResult.alternativeDrugs || [],
        recommendations: geminiResult.recommendations || [],
        warnings: geminiResult.warnings || [],
        // New educational fields
        explanation: geminiResult.explanation,
        mechanism: geminiResult.mechanism,
        clinicalPearls: geminiResult.clinicalPearls || [],
        patientEducation: geminiResult.patientEducation
      };
      
      // Add language-specific formatting if needed
      if (isHebrew) {
        result.warnings = result.warnings.map((w: any) => ({
          ...w,
          message: w.message || w
        }));
      }
      
      return result;
      
    } catch (error) {
      console.error('Gemini API error, falling back to local rules:', error);
      // Fallback to original hardcoded logic
      return this.checkAllergiesLocal(patientAllergies, proposedMedication, language);
    }
  }

  /**
   * Local fallback allergy checking (original hardcoded logic)
   */
  private checkAllergiesLocal(patientAllergies: any[], proposedMedication: string, language = 'en'): AllergyResult {
    const isHebrew = language === 'he';
    const result: AllergyResult = {
      safe: true,
      directAllergy: false,
      crossSensitivity: [],
      severity: null,
      alternatives: [],
      recommendations: [],
      warnings: []
    };

    // Normalize medication name
    const medication = this.normalizeName(proposedMedication);
    
    // Check each patient allergy
    for (const allergy of patientAllergies) {
      const allergyInfo = typeof allergy === 'string' 
        ? { allergen: allergy, severity: 'unknown' }
        : allergy;
      
      const normalizedAllergen = this.normalizeName(allergyInfo.allergen);
      
      // Check for direct allergy
      if (this.isDirectMatch(normalizedAllergen, medication)) {
        result.safe = false;
        result.directAllergy = true;
        result.severity = allergyInfo.severity || 'unknown';
        result.warnings.push({
          type: 'direct',
          message: isHebrew
            ? `אלרגיה ישירה ל-${proposedMedication} - אסור לתת!`
            : `Direct allergy to ${proposedMedication} - DO NOT ADMINISTER!`,
          severity: 'critical'
        });
        break;
      }
      
      // Check for cross-sensitivity
      const crossCheck = this.checkCrossSensitivity(normalizedAllergen, medication);
      if (crossCheck.risk !== 'none') {
        result.crossSensitivity.push({
          allergen: allergyInfo.allergen,
          medication: proposedMedication,
          risk: crossCheck.risk,
          rate: crossCheck.rate,
          mechanism: crossCheck.mechanism
        });
        
        if (crossCheck.risk === 'high') {
          result.safe = false;
          result.warnings.push({
            type: 'cross-sensitivity',
            message: isHebrew
              ? `סיכון גבוה לתגובה צולבת בין ${allergyInfo.allergen} ל-${proposedMedication}`
              : `High risk of cross-reaction between ${allergyInfo.allergen} and ${proposedMedication}`,
            severity: 'high'
          });
        } else if (crossCheck.risk === 'moderate') {
          result.warnings.push({
            type: 'cross-sensitivity',
            message: isHebrew
              ? `סיכון בינוני לתגובה צולבת - נדרשת זהירות`
              : `Moderate risk of cross-reaction - Use with caution`,
            severity: 'medium'
          });
        }
      }
    }
    
    // Get alternatives if not safe
    if (!result.safe || result.crossSensitivity.length > 0) {
      result.alternatives = this.suggestAlternatives(medication, patientAllergies, isHebrew);
    }
    
    // Generate recommendations
    this.generateRecommendations(result, patientAllergies, medication, isHebrew);
    
    return result;
  }

  /**
   * Check for cross-sensitivity
   */
  private checkCrossSensitivity(allergen: string, medication: string) {
    const allergenData = this.crossSensitivities[allergen];
    if (!allergenData) {
      return { risk: 'none' as const, rate: null, mechanism: null };
    }
    
    // Check risk levels
    if (allergenData.highRisk && allergenData.highRisk.includes(medication)) {
      return {
        risk: 'high' as const,
        rate: allergenData.crossReactivityRate?.[this.getMedicationClass(medication)] || 'High',
        mechanism: allergenData.mechanism || 'Structural similarity'
      };
    }
    
    if (allergenData.moderateRisk && allergenData.moderateRisk.includes(medication)) {
      return {
        risk: 'moderate' as const,
        rate: allergenData.crossReactivityRate?.[this.getMedicationClass(medication)] || 'Moderate',
        mechanism: allergenData.mechanism || 'Partial structural similarity'
      };
    }
    
    if (allergenData.lowRisk && allergenData.lowRisk.includes(medication)) {
      return {
        risk: 'low' as const,
        rate: allergenData.crossReactivityRate?.[this.getMedicationClass(medication)] || 'Low',
        mechanism: allergenData.mechanism || 'Minimal structural similarity'
      };
    }
    
    if (allergenData.veryLowRisk && allergenData.veryLowRisk.includes(medication)) {
      return {
        risk: 'very low' as const,
        rate: allergenData.crossReactivityRate?.[this.getMedicationClass(medication)] || '<1%',
        mechanism: allergenData.mechanism || 'Different structure'
      };
    }
    
    return { risk: 'none' as const, rate: null, mechanism: null };
  }

  /**
   * Check latex-related allergies - uses Gemini AI
   */
  async checkLatexAllergy(patientAllergies: any[], item: string, options: AllergyCheckOptions = {}) {
    const { language = 'en', patientContext = {} } = options;
    
    try {
      // Use Gemini for latex allergy analysis
      const geminiResult = await geminiMedicalService.checkAllergies(
        item,
        patientAllergies.filter(a => 
          (typeof a === 'string' ? a : a.allergen).toLowerCase().includes('latex')
        ),
        { ...patientContext, checkType: 'latex-cross-sensitivity' }
      );
      
      return {
        safe: geminiResult.isSafe,
        warning: geminiResult.warnings?.[0],
        risk: geminiResult.riskLevel,
        alternatives: geminiResult.alternativeDrugs
      };
    } catch (error) {
      console.error('Gemini API error, using local latex check:', error);
      return this.checkLatexAllergyLocal(patientAllergies, item, language);
    }
  }

  /**
   * Local fallback for latex allergy checking
   */
  private checkLatexAllergyLocal(patientAllergies: any[], item: string, language = 'en') {
    const isHebrew = language === 'he';
    const hasLatexAllergy = patientAllergies.some(a => 
      this.normalizeName(typeof a === 'string' ? a : a.allergen) === 'latex'
    );
    
    if (!hasLatexAllergy) {
      return { safe: true };
    }
    
    const latexData = this.crossSensitivities.latex;
    const normalizedItem = this.normalizeName(item);
    
    // Check if item is a food with cross-sensitivity
    if (latexData.foodCrossSensitivity.includes(normalizedItem)) {
      return {
        safe: false,
        warning: isHebrew
          ? `זהירות: ${item} עלול לגרום לתגובה צולבת עם אלרגיה ללטקס`
          : `Caution: ${item} may cross-react with latex allergy`,
        risk: 'moderate',
        alternatives: isHebrew ? 'מזונות אחרים' : 'Other foods'
      };
    }
    
    // Check if item is a medical product
    if (latexData.medicalProducts.includes(normalizedItem)) {
      return {
        safe: false,
        warning: isHebrew
          ? `אסור להשתמש ב-${item} - מכיל לטקס`
          : `Do not use ${item} - contains latex`,
        risk: 'high',
        alternatives: latexData.alternatives
      };
    }
    
    return { safe: true };
  }

  /**
   * Check vaccine allergies - uses Gemini AI
   */
  async checkVaccineAllergy(patientAllergies: any[], vaccine: string, options: AllergyCheckOptions = {}) {
    const { language = 'en', patientContext = {} } = options;
    
    try {
      // Use Gemini for vaccine allergy analysis
      const geminiResult = await geminiMedicalService.checkAllergies(
        vaccine,
        patientAllergies,
        { ...patientContext, checkType: 'vaccine', vaccineName: vaccine }
      );
      
      return {
        safe: geminiResult.isSafe,
        warnings: geminiResult.warnings || [],
        precautions: geminiResult.recommendations || []
      };
    } catch (error) {
      console.error('Gemini API error, using local vaccine check:', error);
      return this.checkVaccineAllergyLocal(patientAllergies, vaccine, language);
    }
  }

  /**
   * Local fallback for vaccine allergy checking
   */
  private checkVaccineAllergyLocal(patientAllergies: any[], vaccine: string, language = 'en') {
    const isHebrew = language === 'he';
    const result = {
      safe: true,
      warnings: [] as string[],
      precautions: [] as string[]
    };
    
    // Check egg allergy for vaccines
    const hasEggAllergy = patientAllergies.some(a => 
      this.normalizeName(typeof a === 'string' ? a : a.allergen) === 'egg'
    );
    
    if (hasEggAllergy) {
      const eggData = this.crossSensitivities.egg;
      const normalizedVaccine = this.normalizeName(vaccine);
      
      if (eggData.vaccines.contraindicated.includes(normalizedVaccine)) {
        result.safe = false;
        result.warnings.push(isHebrew
          ? `אסור לתת חיסון ${vaccine} למטופל עם אלרגיה לביצה`
          : `${vaccine} vaccine contraindicated in egg allergy`
        );
      } else if (eggData.vaccines.caution.includes(normalizedVaccine)) {
        result.precautions.push(isHebrew
          ? `נדרשת זהירות - ניתן לתת בהשגחה רפואית`
          : `Caution required - Can be given under medical supervision`
        );
      }
    }
    
    // Check gelatin allergy
    const hasGelatinAllergy = patientAllergies.some(a =>
      this.normalizeName(typeof a === 'string' ? a : a.allergen) === 'gelatin'
    );
    
    if (hasGelatinAllergy && ['mmr', 'varicella', 'zoster'].includes(this.normalizeName(vaccine))) {
      result.safe = false;
      result.warnings.push(isHebrew
        ? `חיסון ${vaccine} מכיל ג'לטין - אסור למטופל עם אלרגיה לג'לטין`
        : `${vaccine} vaccine contains gelatin - contraindicated`
      );
    }
    
    return result;
  }

  /**
   * Suggest alternative medications
   */
  private suggestAlternatives(medication: string, patientAllergies: any[], isHebrew: boolean): AlternativeMedication[] {
    const medicationClass = this.getMedicationClass(medication);
    const alternatives: AlternativeMedication[] = [];
    
    // Get alternatives based on medication class
    if (medicationClass === 'antibiotic') {
      const allergyType = this.determineAntibioticAllergyType(patientAllergies);
      const altList = this.alternatives.antibiotics[allergyType] || [];
      
      for (const alt of altList) {
        // Check if alternative is also an allergen
        const isSafe = !patientAllergies.some(a => 
          this.isDirectMatch(this.normalizeName(typeof a === 'string' ? a : a.allergen), alt)
        );
        
        if (isSafe) {
          alternatives.push({
            medication: alt,
            class: 'antibiotic',
            notes: isHebrew
              ? 'אנטיביוטיקה חלופית בטוחה'
              : 'Safe alternative antibiotic'
          });
        }
      }
    } else if (medicationClass === 'nsaid' || medicationClass === 'analgesic') {
      const altList = this.alternatives.painRelief.nsaid_allergy || [];
      for (const alt of altList) {
        alternatives.push({
          medication: alt,
          class: 'analgesic',
          notes: isHebrew
            ? 'משכך כאבים חלופי'
            : 'Alternative pain reliever'
        });
      }
    } else if (medicationClass === 'anesthetic') {
      const anestheticType = medication.includes('caine') ? 'amide' : 'ester';
      const altList = anestheticType === 'amide' 
        ? ['procaine', 'benzocaine', 'tetracaine']
        : ['lidocaine', 'bupivacaine', 'mepivacaine'];
      
      for (const alt of altList) {
        alternatives.push({
          medication: alt,
          class: 'anesthetic',
          notes: isHebrew
            ? 'חומר הרדמה מקומי חלופי'
            : 'Alternative local anesthetic'
        });
      }
    }
    
    return alternatives;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(result: AllergyResult, patientAllergies: any[], medication: string, isHebrew: boolean) {
    const recommendations: Recommendation[] = [];
    
    if (result.directAllergy) {
      recommendations.push({
        priority: 'critical',
        action: isHebrew
          ? 'אסור לתת את התרופה - אלרגיה ישירה!'
          : 'DO NOT ADMINISTER - Direct allergy!',
        alternatives: result.alternatives.length > 0
      });
      
      if (result.severity === 'anaphylaxis' || result.severity === 'severe') {
        recommendations.push({
          priority: 'critical',
          action: isHebrew
            ? 'הכן אפינפרין ועציוד החייאה'
            : 'Have epinephrine and resuscitation equipment ready'
        });
      }
    }
    
    if (result.crossSensitivity.length > 0) {
      const highRisk = result.crossSensitivity.filter(cs => cs.risk === 'high');
      const moderateRisk = result.crossSensitivity.filter(cs => cs.risk === 'moderate');
      
      if (highRisk.length > 0) {
        recommendations.push({
          priority: 'high',
          action: isHebrew
            ? 'הימנע מהתרופה - סיכון גבוה לתגובה צולבת'
            : 'Avoid medication - High cross-reactivity risk'
        });
      }
      
      if (moderateRisk.length > 0 && highRisk.length === 0) {
        recommendations.push({
          priority: 'medium',
          action: isHebrew
            ? 'ניתן לתת בזהירות תחת השגחה רפואית'
            : 'May administer with caution under medical supervision'
        });
        
        recommendations.push({
          priority: 'medium',
          action: isHebrew
            ? 'התחל במינון בדיקה קטן'
            : 'Start with small test dose'
        });
      }
    }
    
    // Premedication recommendations
    if (result.crossSensitivity.some(cs => cs.risk === 'moderate' || cs.risk === 'low')) {
      recommendations.push({
        priority: 'low',
        action: isHebrew
          ? 'שקול מתן אנטיהיסטמין מונע'
          : 'Consider prophylactic antihistamine'
      });
    }
    
    // Documentation recommendation
    recommendations.push({
      priority: 'routine',
      action: isHebrew
        ? 'תעד את הבדיקה והחלטה ברשומה הרפואית'
        : 'Document allergy check and decision in medical record'
    });
    
    result.recommendations = recommendations;
  }

  /**
   * Helper: Normalize medication/allergen name
   */
  private normalizeName(name: string): string {
    if (!name) return '';
    
    // Just normalize to lowercase and remove special characters
    // DO NOT remove medication suffixes as they are part of the drug name!
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /**
   * Helper: Check for direct match
   */
  private isDirectMatch(allergen: string, medication: string): boolean {
    // Direct match or substring match
    return allergen === medication || 
           medication.includes(allergen) || 
           allergen.includes(medication);
  }

  /**
   * Helper: Get medication class
   */
  private getMedicationClass(medication: string): string {
    const med = medication.toLowerCase();
    
    // Antibiotics
    if (med.includes('cillin') || med.includes('cef') || med.includes('mycin') || 
        med.includes('floxacin') || med.includes('cycline')) {
      return 'antibiotic';
    }
    
    // NSAIDs
    if (med.includes('profen') || med.includes('proxen') || med.includes('clofenac') ||
        med === 'aspirin' || med.includes('celecoxib')) {
      return 'nsaid';
    }
    
    // Opioids
    if (med.includes('morphine') || med.includes('codone') || med.includes('codeine') ||
        med.includes('fentanyl') || med.includes('tramadol')) {
      return 'opioid';
    }
    
    // Local anesthetics
    if (med.includes('caine')) {
      return 'anesthetic';
    }
    
    // Statins
    if (med.includes('statin')) {
      return 'statin';
    }
    
    // ACE inhibitors
    if (med.includes('pril')) {
      return 'ace_inhibitor';
    }
    
    // Beta blockers
    if (med.includes('olol')) {
      return 'beta_blocker';
    }
    
    return 'other';
  }

  /**
   * Helper: Determine antibiotic allergy type
   */
  private determineAntibioticAllergyType(allergies: any[]): string {
    const normalizedAllergies = allergies.map(a => 
      this.normalizeName(typeof a === 'string' ? a : a.allergen)
    );
    
    if (normalizedAllergies.some(a => a.includes('penicillin') || a.includes('cillin'))) {
      return 'penicillin_allergy';
    }
    if (normalizedAllergies.some(a => a.includes('cef') || a.includes('cephalosporin'))) {
      return 'cephalosporin_allergy';
    }
    if (normalizedAllergies.some(a => a.includes('sulfa'))) {
      return 'sulfa_allergy';
    }
    if (normalizedAllergies.some(a => a.includes('floxacin'))) {
      return 'fluoroquinolone_allergy';
    }
    
    return 'unknown_allergy';
  }
}