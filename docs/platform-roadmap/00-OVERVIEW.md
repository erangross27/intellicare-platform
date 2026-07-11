# IntelliCare Platform Roadmap - Task Breakdown

## Constraints
- **No business ID (EIN/TIN)** - Cannot register with clearinghouses or paid services
- **No budget for paid APIs** - Only free/government APIs
- **US market focus** - American healthcare system
- **Already integrated**: OpenFDA, CMS Provider Directory, ClinicalTrials.gov, NIH RePORTER, PubMed, CDC, SAMHSA, HRSA, USDA, EPA, Healthcare.gov, Blue Button 2.0 (full OAuth+PKCE, 3 route files, 2 agent tools, sandbox credentials in KMS — production pending CMS approval only)

## Task Categories

### Phase 1: Wire Existing Backend Services to Agent (No External Dependencies)
These services already exist in the codebase but are NOT connected to the chat agent.
| # | Task | File | Priority |
|---|------|------|----------|
| 01 | ~~Wire billingService to agent (internal invoicing only)~~ | `01-wire-billing-to-agent.md` | DONE |
| 02 | ~~Add meeting update + recurring meeting tools~~ | `02-meeting-tools.md` | DONE |
| 03 | ~~Add custom role management tools~~ | `03-role-management-tools.md` | DONE |
| 04 | ~~Wire formularyService drug lookup to agent~~ | `04-formulary-drug-lookup.md` | DONE |
| 05 | ~~Add missing permission tools~~ | `05-permission-tools.md` | DONE |

### Phase 2: Free Government API Integrations (New)
Free APIs from US government agencies - no business ID needed.
| # | Task | File | Priority |
|---|------|------|----------|
| 06 | ~~Integrate RxNorm/RxNav drug nomenclature API~~ | `06-rxnorm-rxnav-api.md` | DONE |
| 07 | ~~Integrate DailyMed drug labeling API~~ | `07-dailymed-api.md` | DONE |
| 08 | ~~Integrate ICD-10-CM diagnosis code lookup~~ | `08-icd10-code-lookup.md` | DONE |
| 09 | ~~Integrate Medicare Coverage API (LCD/NCD)~~ — **REMOVED: No public API exists, web-only search tool** | `09-medicare-coverage-api.md` | REMOVED |
| 10 | ~~Integrate Medicaid Data API (DKAN, 3 agent tools, enrollment + drug utilization)~~ | `10-medicaid-data-api.md` | DONE |
| 11 | Integrate UMLS Terminology Services | `11-umls-terminology.md` | MEDIUM |
| 12 | Integrate LOINC FHIR Terminology Server | `12-loinc-fhir.md` | LOW |
| 13 | Integrate WHO ICD API | `13-who-icd-api.md` | LOW |

### Phase 3: Enhance Existing Integrations
Improve and expand what's already connected.
| # | Task | File | Priority |
|---|------|------|----------|
| 14 | ~~Activate Blue Button 2.0 (full OAuth+PKCE, 3 routes, 2 agent tools, QR import)~~ — **production pending CMS approval only** | `14-blue-button-production.md` | DONE |
| 15 | ~~Build medication entitlement using free APIs only~~ | `15-medication-entitlement-free.md` | DONE |
| 16 | Enhance CMS provider directory features | `16-enhance-cms-provider.md` | MEDIUM |
| 17 | Add FHIR sandbox testing (Epic, HAPI) | `17-fhir-sandbox-testing.md` | LOW |

### Phase 4: Agent Capability Gaps
Missing tools and features for complete chat-based management.
| # | Task | File | Priority |
|---|------|------|----------|
| 18 | ~~Add export tools (users, patients CSV/PDF)~~ | `18-export-tools.md` | DONE |
| 19 | ~~Add user session management tools~~ | `19-user-session-tools.md` | DONE |
| 20 | ~~Add claim status tracking (internal only)~~ | `20-internal-claim-tracking.md` | DONE |

## How to Use This Roadmap
1. Each `.md` file is a self-contained task
2. No code - just instructions, context, and what files to modify
3. Tasks are independent unless noted in "Dependencies" section
4. Start with Phase 1 (zero external dependencies, immediate value)
