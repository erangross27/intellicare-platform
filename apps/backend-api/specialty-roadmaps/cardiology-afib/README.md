# Cardiology - Atrial Fibrillation Specialty Roadmap

**Specialty**: Cardiology - Arrhythmia Management
**Patient Scenario**: New-onset Atrial Fibrillation requiring anticoagulation and rhythm monitoring
**Status**: Documentation Phase (NO CODE)
**Total Tools Identified**: 5 (All Tier 1 - Critical)

---

## 🚨 CRITICAL PATIENT SAFETY ISSUES

### New AF Diagnosis Gaps:
1. **NO HOLTER ORDERING** - Cannot order 24-48hr ambulatory ECG monitoring
2. **NO INR TRACKING** - Warfarin management without structured monitoring dashboard
3. **NO AF BURDEN CALC** - Cannot quantify arrhythmia episodes (% time in AF)
4. **MANUAL CHA2DS2-VASc** - Stroke risk calculation buried in notes, not automated
5. **NO PATIENT EDUCATION** - Cannot send AF-specific educational materials via portal

---

## 📋 TIER 1 - CRITICAL TOOLS (All 5 tools)

### **Tool #1: Holter Monitor Ordering System** ⭐ START HERE
- **Problem**: No dedicated function for ordering ambulatory cardiac monitors
- **Current Workaround**: Using `orderImaging()` (incorrect collection)
- **Impact**: Orders misrouted, monitoring delays, inadequate AF burden assessment
- **Timeline**: 3-4 days

### **Tool #2: INR Tracking Dashboard**
- **Problem**: Warfarin patients need frequent INR monitoring without visual tracking
- **Current State**: Labs exist but no therapeutic range tracking, trend graphs, or dose adjustment alerts
- **Impact**: Increased bleeding/clotting risk, manual chart review inefficient
- **Timeline**: 4-5 days

### **Tool #3: AF Burden Calculator**
- **Problem**: Cannot calculate % time spent in AF from Holter/event monitor data
- **Current State**: Manual review of reports, no quantitative trending
- **Impact**: Rhythm control strategy unclear, cannot track ablation success
- **Timeline**: 3-4 days

### **Tool #4: CHA2DS2-VASc Risk Calculator**
- **Problem**: Stroke risk stratification done manually in clinical notes
- **Current State**: Calculated once at diagnosis, not updated with new conditions
- **Impact**: Anticoagulation decisions may be outdated, score not visible in UI
- **Timeline**: 2-3 days

### **Tool #5: Patient Portal Messaging for AF Education**
- **Problem**: No way to send targeted educational content about new AF diagnosis
- **Current State**: Generic portal messages only
- **Impact**: Patient anxiety, medication non-adherence, missed follow-ups
- **Timeline**: 4-5 days

---

## 📊 IMPLEMENTATION SUMMARY

| Tool | Priority | Days | Blocking? | Dependencies |
|------|----------|------|-----------|--------------|
| Holter Monitor Ordering | Critical | 3-4 | Yes | New `cardiac_monitors` collection |
| INR Tracking Dashboard | Critical | 4-5 | No | Existing `lab_results` |
| AF Burden Calculator | Critical | 3-4 | Yes | Holter data import |
| CHA2DS2-VASc Calculator | Critical | 2-3 | No | Patient demographics + diagnoses |
| Patient Portal Messaging | Critical | 4-5 | No | Existing portal framework |

**Total Estimated Timeline**: 16-21 days (if done sequentially)
**Parallel Timeline**: 8-10 days (2 developers)

---

## 🎯 SUCCESS CRITERIA

- ✅ Holter monitors can be ordered through proper cardiac workflow
- ✅ INR values display with therapeutic range, trend graph, and dose alerts
- ✅ AF burden % calculated automatically from Holter reports
- ✅ CHA2DS2-VASc score auto-updates and displays in patient summary
- ✅ AF educational materials sent via portal with read receipts

---

## 📁 FILES IN THIS ROADMAP

```
specialty-roadmaps/cardiology-afib/
├── README.md                          ← You are here
├── CRITICAL-GAPS.md                   ← Detailed gap analysis
├── ALL-TASKS-SUMMARY.md               ← Complete implementation guide
└── tier-1-critical/
    ├── README.md                      ← Phase 1 overview
    ├── 01-holter-monitor-ordering.md  ← Ambulatory ECG system
    ├── 02-inr-tracking-dashboard.md   ← Anticoagulation monitoring
    ├── 03-af-burden-calculator.md     ← Arrhythmia quantification
    ├── 04-cha2ds2-vasc-calculator.md  ← Stroke risk scoring
    └── 05-patient-portal-messaging.md ← AF education delivery
```

---

## 🔄 PATTERN CONSISTENCY

Following established framework from:
- ✅ Hospital Discharge Summary (9 tools)
- ✅ Allergy & Immunology (10 tools)
- ✅ Anesthesiology/Perioperative (10 tools)
- ✅ Cardiology ACS (14 tools)
- ✅ **Cardiology AF (5 tools)** ← NEW

Each tool document includes:
- ✅ Clinical background & AF guidelines (ACC/AHA/ESC)
- ✅ Decision logic & algorithms
- ✅ Data models & MongoDB collections
- ✅ Function specifications (no code, just specs)
- ✅ UI mockups & user workflows
- ✅ Integration points
- ✅ Success criteria & testing strategy

---

## 📚 CLINICAL GUIDELINES REFERENCED

- **ACC/AHA/HRS Atrial Fibrillation Guideline (2023)**
- **ESC Atrial Fibrillation Guidelines (2024)**
- **CHA2DS2-VASc Score for Stroke Risk (2010, validated)**
- **HAS-BLED Bleeding Risk Score**
- **INR Therapeutic Ranges (ACC/AHA Anticoagulation)**
- **AF Burden and Outcomes (JAMA Cardiology 2020)**

---

## 🚀 GETTING STARTED

**START WITH**: Tool #1 - Holter Monitor Ordering System

**Why Tool #1 first?**
- BLOCKS: AF burden calculation (Tool #3) cannot work without Holter data
- Most urgent clinical need: Quantifying AF episodes to guide treatment
- Creates new `cardiac_monitors` collection used by other tools
- Relatively simple implementation (3-4 days)

**Next Steps:**
1. Read `tier-1-critical/01-holter-monitor-ordering.md`
2. Implement 6-step checklist (schema → handler → routes → frontend)
3. Test with sample Holter order
4. Move to Tool #4 (CHA2DS2-VASc) - independent, fast win

---

**Generated**: October 19, 2025
**Last Updated**: October 19, 2025
🤖 Generated with Claude Code
