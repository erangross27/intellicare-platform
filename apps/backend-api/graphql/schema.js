// GraphQL Schema Definition
// Defines the GraphQL API structure with security considerations

const { gql } = require('apollo-server-express');

const typeDefs = gql`
  # Scalars
  scalar DateTime
  scalar JSON

  # Enums
  enum UserRole {
    PATIENT
    DOCTOR
    ADMIN
  }

  enum DocumentType {
    MEDICAL_RECORD
    LAB_RESULT
    PRESCRIPTION
    IMAGING
    REPORT
  }

  enum DiagnosticStatus {
    PENDING
    IN_PROGRESS
    COMPLETED
    FAILED
  }

  # Types
  type User {
    id: ID!
    email: String!
    firstName: String!
    lastName: String!
    role: UserRole!
    createdAt: DateTime!
    updatedAt: DateTime!
    
    # Relations (field-level authorization applied)
    patients: [Patient!] @auth(requires: DOCTOR)
    documents: [Document!] @auth(requires: USER)
  }

  type Patient {
    id: ID!
    firstName: String!
    lastName: String!
    dateOfBirth: DateTime!
    gender: String
    phone: String
    email: String
    createdAt: DateTime!
    updatedAt: DateTime!
    
    # Relations
    documents: [Document!]
    diagnostics: [Diagnostic!] @auth(requires: DOCTOR)
    medicalHistory: JSON @auth(requires: DOCTOR)
    
    # Computed fields (expensive operations)
    fullName: String! @cost(complexity: 1)
    age: Int! @cost(complexity: 2)
    riskScore: Float @cost(complexity: 10) @auth(requires: DOCTOR)
  }

  type Document {
    id: ID!
    filename: String!
    originalName: String!
    mimeType: String!
    size: Int!
    type: DocumentType!
    content: String @auth(requires: DOCTOR) # Expensive field
    extractedText: String @auth(requires: DOCTOR)
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!
    
    # Relations
    patient: Patient!
    uploadedBy: User!
    
    # AI Analysis (very expensive)
    aiAnalysis: AIAnalysis @cost(complexity: 50) @auth(requires: DOCTOR)
  }

  type AIAnalysis {
    id: ID!
    summary: String!
    keyFindings: [String!]!
    recommendations: [String!]!
    confidence: Float!
    processedAt: DateTime!
    model: String!
    
    # Expensive nested analysis
    detailedAnalysis: JSON @cost(complexity: 25)
    similarCases: [Patient!] @cost(complexity: 30) @auth(requires: DOCTOR)
  }

  type Diagnostic {
    id: ID!
    type: String!
    status: DiagnosticStatus!
    results: JSON
    confidence: Float
    createdAt: DateTime!
    completedAt: DateTime
    
    # Relations
    patient: Patient!
    requestedBy: User!
    
    # Expensive operations
    detailedReport: String @cost(complexity: 20) @auth(requires: DOCTOR)
    recommendations: [String!] @cost(complexity: 15) @auth(requires: DOCTOR)
  }

  # Input types
  input PatientInput {
    firstName: String!
    lastName: String!
    dateOfBirth: DateTime!
    gender: String
    phone: String
    email: String
  }

  input PatientFilter {
    search: String
    gender: String
    ageRange: AgeRangeInput
    createdAfter: DateTime
    limit: Int = 20
    offset: Int = 0
  }

  input AgeRangeInput {
    min: Int
    max: Int
  }

  input DocumentFilter {
    type: DocumentType
    patientId: ID
    createdAfter: DateTime
    limit: Int = 10
    offset: Int = 0
  }

  input DiagnosticInput {
    patientId: ID!
    type: String!
    parameters: JSON
  }

  # Response types
  type PaginatedPatients {
    patients: [Patient!]!
    total: Int!
    hasMore: Boolean!
  }

  type PaginatedDocuments {
    documents: [Document!]!
    total: Int!
    hasMore: Boolean!
  }

  type UploadResult {
    success: Boolean!
    document: Document
    message: String
  }

  type DiagnosticResult {
    success: Boolean!
    diagnostic: Diagnostic
    message: String
  }

  # Admin types
  type SystemStats {
    totalPatients: Int!
    totalDocuments: Int!
    totalDiagnostics: Int!
    activeUsers: Int!
    systemHealth: JSON!
    performanceMetrics: JSON!
  }

  # Queries
  type Query {
    # User queries
    me: User @auth(requires: USER)
    
    # Patient queries (expensive, limited)
    patients(filter: PatientFilter): PaginatedPatients! @cost(complexity: 20) @auth(requires: DOCTOR)
    patient(id: ID!): Patient @cost(complexity: 10) @auth(requires: DOCTOR)
    searchPatients(query: String!, limit: Int = 10): [Patient!]! @cost(complexity: 30) @auth(requires: DOCTOR)
    
    # Document queries
    documents(filter: DocumentFilter): PaginatedDocuments! @cost(complexity: 15) @auth(requires: USER)
    document(id: ID!): Document @cost(complexity: 5) @auth(requires: USER)
    
    # Diagnostic queries
    diagnostics(patientId: ID, limit: Int = 20): [Diagnostic!]! @cost(complexity: 25) @auth(requires: DOCTOR)
    diagnostic(id: ID!): Diagnostic @cost(complexity: 10) @auth(requires: DOCTOR)
    
    # Expensive analytical queries
    patientRiskAnalysis(patientId: ID!): JSON @cost(complexity: 100) @auth(requires: DOCTOR)
    similarPatients(patientId: ID!, limit: Int = 5): [Patient!]! @cost(complexity: 80) @auth(requires: DOCTOR)
    
    # Admin queries (very restricted)
    adminStats: SystemStats @cost(complexity: 50) @auth(requires: ADMIN)
    systemHealth: JSON @cost(complexity: 10) @auth(requires: ADMIN)
  }

  # Mutations
  type Mutation {
    # Patient mutations
    createPatient(input: PatientInput!): Patient! @cost(complexity: 15) @auth(requires: DOCTOR)
    updatePatient(id: ID!, input: PatientInput!): Patient! @cost(complexity: 10) @auth(requires: DOCTOR)
    deletePatient(id: ID!): Boolean! @cost(complexity: 5) @auth(requires: ADMIN)
    
    # Document mutations
    uploadDocument(patientId: ID!, type: DocumentType!): UploadResult! @cost(complexity: 25) @auth(requires: USER)
    deleteDocument(id: ID!): Boolean! @cost(complexity: 5) @auth(requires: DOCTOR)
    
    # Diagnostic mutations (expensive)
    runDiagnostic(input: DiagnosticInput!): DiagnosticResult! @cost(complexity: 50) @auth(requires: DOCTOR)
    retryDiagnostic(id: ID!): DiagnosticResult! @cost(complexity: 30) @auth(requires: DOCTOR)
    
    # AI Analysis mutations (very expensive)
    analyzeDocument(documentId: ID!): AIAnalysis! @cost(complexity: 100) @auth(requires: DOCTOR)
    batchAnalyzeDocuments(documentIds: [ID!]!): [AIAnalysis!]! @cost(complexity: 200) @auth(requires: ADMIN)
    
    # Admin mutations
    resetSystemStats: Boolean! @cost(complexity: 5) @auth(requires: ADMIN)
    maintenanceMode(enabled: Boolean!): Boolean! @cost(complexity: 10) @auth(requires: ADMIN)
  }

  # Subscriptions (if needed)
  type Subscription {
    diagnosticUpdated(patientId: ID): Diagnostic! @auth(requires: DOCTOR)
    documentProcessed(patientId: ID): Document! @auth(requires: USER)
    systemAlert: JSON! @auth(requires: ADMIN)
  }

  # Custom directives for security
  directive @auth(requires: UserRole!) on FIELD_DEFINITION
  directive @cost(complexity: Int!) on FIELD_DEFINITION
`;

module.exports = typeDefs;