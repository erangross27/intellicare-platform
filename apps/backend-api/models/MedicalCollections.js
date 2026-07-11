/**
 * Medical Collections Schema Definitions
 * Each medical data type gets its own collection to avoid MongoDB 16MB limit
 * All collections are linked via patientId
 */

const mongoose = require('mongoose');

// ============= CONSULTATION NOTES COLLECTION =============
const ConsultationNoteSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'Patient'
  },
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'Document'  // Links to the actual document with encrypted content
  },
  date: {
    type: Date,
    default: Date.now,
    index: true
  },
  diagnosis: {
    type: String,
    required: true
  },
  symptoms: String,
  treatment: String,
  visitType: {
    type: String,
    enum: ['routine', 'emergency', 'follow-up', 'consultation'],
    default: 'routine'
  },
  chiefComplaint: String,
  historyOfPresentIllness: String,
  physicalExamination: String,
  assessmentAndPlan: String,
  vitalSigns: {
    bloodPressure: String,
    heartRate: Number,
    temperature: Number,
    respiratoryRate: Number,
    oxygenSaturation: Number,
    weight: Number,
    height: Number
  },
  doctorName: String,
  practiceName: String,
  followUpDate: Date,
  notes: String,
  documentId: mongoose.Schema.Types.ObjectId,
  source: String,
  aiProcessed: { type: Boolean, default: false },
  confidence: { type: Number, min: 0, max: 1 }
}, { timestamps: true });

// ============= PRESCRIPTIONS COLLECTION =============
const PrescriptionSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'Patient'
  },
  date: {
    type: Date,
    default: Date.now,
    index: true
  },
  medications: [{
    name: { type: String, required: true },
    genericName: String,
    dosage: String,
    frequency: String,
    route: {
      type: String,
      enum: ['Oral', 'IV', 'IM', 'SC', 'Topical', 'Inhaled', 'Rectal', 'Nasal', 'Other'],
      default: 'Oral'
    },
    duration: String,
    quantity: Number,
    refills: Number,
    instructions: String,
    indication: String,
    contraindications: [String],
    sideEffects: [String]
  }],
  prescribingDoctor: String,
  prescribingDoctorLicense: String,
  validUntil: Date,
  dispensedDate: Date,
  dispensedBy: String,
  pharmacy: String,
  controlled: { type: Boolean, default: false },
  notes: String,
  documentId: mongoose.Schema.Types.ObjectId,
  source: String,
  aiProcessed: { type: Boolean, default: false }
}, { timestamps: true });

// ============= LAB RESULTS COLLECTION =============
const LabResultSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'Patient'
  },
  date: {
    type: Date,
    default: Date.now,
    index: true
  },
  testType: {
    type: String,
    required: true,
    index: true
  },
  category: {
    type: String,
    enum: ['hematology', 'chemistry', 'microbiology', 'pathology', 'immunology', 'genetics', 'other'],
    index: true
  },
  results: [{
    parameter: { type: String, required: true },
    value: { type: String, required: true },
    unit: String,
    referenceRange: String,
    flag: {
      type: String,
      enum: ['normal', 'high', 'low', 'critical-high', 'critical-low', 'abnormal'],
      default: 'normal'
    },
    interpretation: String
  }],
  overallInterpretation: String,
  labName: String,
  labAddress: String,
  orderedBy: String,
  collectionDate: Date,
  receivedDate: Date,
  reportedDate: Date,
  specimen: String,
  fastingStatus: String,
  criticalValues: [String],
  notes: String,
  documentId: mongoose.Schema.Types.ObjectId,
  source: String,
  aiProcessed: { type: Boolean, default: false }
}, { timestamps: true });

// ============= IMAGING REPORTS COLLECTION =============
const ImagingReportSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'Patient'
  },
  date: {
    type: Date,
    default: Date.now,
    index: true
  },
  imagingType: {
    type: String,
    enum: ['x-ray', 'ct', 'mri', 'ultrasound', 'pet', 'pet-ct', 'mammography', 'dexa', 'angiography', 'fluoroscopy', 'other'],
    required: true,
    index: true
  },
  bodyPart: String,
  indication: String,
  technique: String,
  contrast: {
    used: Boolean,
    type: String,
    amount: String,
    reaction: String
  },
  findings: {
    type: String,
    required: true
  },
  impression: {
    type: String,
    required: true
  },
  comparison: String,
  recommendations: [String],
  radiologist: String,
  radiologistLicense: String,
  facility: String,
  accessionNumber: String,
  radiation: {
    dose: Number,
    unit: String
  },
  images: [{
    url: String,
    description: String,
    series: String
  }],
  criticalFindings: Boolean,
  communicatedTo: String,
  communicatedAt: Date,
  notes: String,
  documentId: mongoose.Schema.Types.ObjectId,
  source: String,
  aiProcessed: { type: Boolean, default: false }
}, { timestamps: true });

// ============= DISCHARGE SUMMARIES COLLECTION =============
const DischargeSummarySchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'Patient'
  },
  admissionDate: {
    type: Date,
    required: true,
    index: true
  },
  dischargeDate: {
    type: Date,
    required: true,
    index: true
  },
  hospitalName: String,
  department: String,
  admittingDiagnosis: String,
  dischargeDiagnosis: [{
    primary: Boolean,
    code: String,
    description: String
  }],
  procedures: [{
    date: Date,
    name: String,
    code: String,
    surgeon: String,
    complications: String
  }],
  hospitalCourse: String,
  dischargeMedications: [{
    name: String,
    dosage: String,
    frequency: String,
    duration: String,
    reason: String
  }],
  dischargeInstructions: String,
  followUpAppointments: [{
    specialty: String,
    doctor: String,
    timeframe: String,
    reason: String
  }],
  dietRestrictions: String,
  activityRestrictions: String,
  condition: {
    type: String,
    enum: ['stable', 'improved', 'unchanged', 'worsened', 'critical']
  },
  disposition: {
    type: String,
    enum: ['home', 'rehabilitation', 'skilled-nursing', 'long-term-care', 'hospice', 'other']
  },
  attendingPhysician: String,
  notes: String,
  documentId: mongoose.Schema.Types.ObjectId,
  source: String,
  aiProcessed: { type: Boolean, default: false }
}, { timestamps: true });

// ============= VACCINATION RECORDS COLLECTION =============
const VaccinationRecordSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'Patient'
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  vaccine: {
    type: String,
    required: true,
    index: true
  },
  tradeName: String,
  manufacturer: String,
  lotNumber: String,
  expirationDate: Date,
  dose: String,
  doseNumber: Number,
  series: String,
  route: {
    type: String,
    enum: ['IM', 'SC', 'Oral', 'Nasal', 'ID'],
    default: 'IM'
  },
  site: String,
  administeredBy: String,
  administeredByTitle: String,
  facility: String,
  nextDueDate: Date,
  adverseReaction: {
    occurred: Boolean,
    description: String,
    severity: String,
    reported: Boolean
  },
  contraindications: [String],
  notes: String,
  documentId: mongoose.Schema.Types.ObjectId,
  source: String,
  aiProcessed: { type: Boolean, default: false }
}, { timestamps: true });

// ============= ALLERGIES COLLECTION =============
const AllergySchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'Patient'
  },
  allergen: {
    type: String,
    required: true,
    index: true
  },
  category: {
    type: String,
    enum: ['medication', 'food', 'environmental', 'latex', 'contrast', 'other'],
    index: true
  },
  reaction: String,
  severity: {
    type: String,
    enum: ['mild', 'moderate', 'severe', 'life-threatening'],
    default: 'moderate'
  },
  dateIdentified: {
    type: Date,
    default: Date.now
  },
  verifiedBy: String,
  verificationMethod: String,
  symptoms: [String],
  treatment: String,
  crossReactivity: [String],
  status: {
    type: String,
    enum: ['active', 'inactive', 'resolved', 'suspected'],
    default: 'active',
    index: true
  },
  notes: String,
  documentId: mongoose.Schema.Types.ObjectId,
  source: String
}, { timestamps: true });

// ============= CURRENT MEDICATIONS COLLECTION =============
const MedicationSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'Patient'
  },
  name: {
    type: String,
    required: true,
    index: true
  },
  genericName: String,
  dosage: String,
  frequency: String,
  route: {
    type: String,
    enum: ['Oral', 'IV', 'IM', 'SC', 'Topical', 'Inhaled', 'Rectal', 'Nasal', 'Other'],
    default: 'Oral'
  },
  startDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  endDate: Date,
  duration: String,
  indication: String,
  prescribedBy: String,
  prescribedDate: Date,
  pharmacy: String,
  refillsRemaining: Number,
  lastRefillDate: Date,
  adherence: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'poor', 'unknown'],
    default: 'unknown'
  },
  effectiveness: {
    type: String,
    enum: ['effective', 'partially-effective', 'ineffective', 'unknown'],
    default: 'unknown'
  },
  sideEffects: [String],
  active: {
    type: Boolean,
    default: true,
    index: true
  },
  discontinuedReason: String,
  notes: String,
  documentId: mongoose.Schema.Types.ObjectId,
  source: String
}, { timestamps: true });

// ============= APPOINTMENTS COLLECTION =============
const AppointmentSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'Patient'
  },
  appointmentNumber: {
    type: String,
    unique: true,
    index: true
  },
  scheduledDate: {
    type: Date,
    required: true,
    index: true
  },
  scheduledTime: String,
  duration: Number, // in minutes
  appointmentType: {
    type: String,
    enum: ['consultation', 'follow-up', 'procedure', 'surgery', 'lab', 'imaging', 'vaccination', 'telemedicine'],
    index: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'checked-in', 'in-progress', 'completed', 'cancelled', 'no-show', 'rescheduled'],
    default: 'scheduled',
    index: true
  },
  providerId: String,
  providerName: String,
  providerSpecialty: String,
  department: String,
  facility: String,
  room: String,
  reason: String,
  referralRequired: Boolean,
  referralNumber: String,
  insuranceVerified: Boolean,
  copayAmount: Number,
  remindersSent: [{
    method: String,
    sentAt: Date
  }],
  checkinTime: Date,
  seenTime: Date,
  checkoutTime: Date,
  cancellationReason: String,
  rescheduledFrom: mongoose.Schema.Types.ObjectId,
  rescheduledTo: mongoose.Schema.Types.ObjectId,
  notes: String,
  documentId: mongoose.Schema.Types.ObjectId,
  source: String
}, { timestamps: true });

// ============= REFERRALS COLLECTION =============
const ReferralSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'Patient'
  },
  date: {
    type: Date,
    default: Date.now,
    index: true
  },
  referredTo: {
    type: String,
    required: true
  },
  referredToId: String,
  specialty: {
    type: String,
    required: true,
    index: true
  },
  referredBy: String,
  referredById: String,
  reason: {
    type: String,
    required: true
  },
  urgency: {
    type: String,
    enum: ['routine', 'urgent', 'emergency', 'elective'],
    default: 'routine',
    index: true
  },
  diagnosis: String,
  clinicalInformation: String,
  requestedServices: [String],
  insuranceAuthorizationRequired: Boolean,
  authorizationNumber: String,
  authorizationStatus: {
    type: String,
    enum: ['pending', 'approved', 'denied', 'not-required']
  },
  appointmentScheduled: Boolean,
  appointmentDate: Date,
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'completed', 'expired', 'cancelled'],
    default: 'pending',
    index: true
  },
  consultationReport: String,
  notes: String,
  documentId: mongoose.Schema.Types.ObjectId,
  source: String
}, { timestamps: true });

// ============= MEDICAL CERTIFICATES COLLECTION =============
const MedicalCertificateSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'Patient'
  },
  date: {
    type: Date,
    default: Date.now,
    index: true
  },
  purpose: {
    type: String,
    required: true
  },
  certificateType: {
    type: String,
    enum: ['sick-leave', 'fitness', 'disability', 'travel', 'return-to-work', 'school', 'other'],
    index: true
  },
  validFrom: {
    type: Date,
    required: true
  },
  validTo: Date,
  diagnosis: String,
  restrictions: [String],
  capabilities: [String],
  recommendations: [String],
  issuedBy: String,
  issuedByLicense: String,
  issuedBySignature: String,
  facility: String,
  verificationCode: String,
  notes: String,
  documentId: mongoose.Schema.Types.ObjectId,
  source: String
}, { timestamps: true });

// ============= MEDICAL PROCEDURES COLLECTION =============
const MedicalProcedureSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'Patient'
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  procedure: {
    type: String,
    required: true
  },
  procedureCode: String,
  category: {
    type: String,
    enum: ['diagnostic', 'therapeutic', 'surgical', 'minor', 'major'],
    index: true
  },
  surgeon: String,
  surgeonLicense: String,
  assistants: [String],
  anesthesia: {
    type: String,
    enum: ['general', 'regional', 'local', 'sedation', 'none']
  },
  anesthesiologist: String,
  preOpDiagnosis: String,
  postOpDiagnosis: String,
  findings: String,
  technique: String,
  specimens: [String],
  implants: [{
    type: String,
    manufacturer: String,
    model: String,
    serialNumber: String
  }],
  duration: Number, // in minutes
  bloodLoss: String,
  complications: String,
  outcome: {
    type: String,
    enum: ['successful', 'partially-successful', 'unsuccessful', 'aborted']
  },
  postOpInstructions: String,
  followUpRequired: Boolean,
  pathologyPending: Boolean,
  facility: String,
  operatingRoom: String,
  notes: String,
  documentId: mongoose.Schema.Types.ObjectId,
  source: String
}, { timestamps: true });

// Create indexes for efficient queries
const createIndexes = (schema) => {
  schema.index({ patientId: 1, date: -1 });
  schema.index({ patientId: 1, createdAt: -1 });
  if (schema.paths.status) {
    schema.index({ patientId: 1, status: 1 });
  }
  if (schema.paths.active) {
    schema.index({ patientId: 1, active: 1 });
  }
};

// Apply indexes to all schemas
[
  ConsultationNoteSchema,
  PrescriptionSchema,
  LabResultSchema,
  ImagingReportSchema,
  DischargeSummarySchema,
  VaccinationRecordSchema,
  AllergySchema,
  MedicationSchema,
  AppointmentSchema,
  ReferralSchema,
  MedicalCertificateSchema,
  MedicalProcedureSchema
].forEach(createIndexes);

// Export schemas
module.exports = {
  ConsultationNoteSchema,
  PrescriptionSchema,
  LabResultSchema,
  ImagingReportSchema,
  DischargeSummarySchema,
  VaccinationRecordSchema,
  AllergySchema,
  MedicationSchema,
  AppointmentSchema,
  ReferralSchema,
  MedicalCertificateSchema,
  MedicalProcedureSchema
};