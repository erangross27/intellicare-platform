# Medical History Component Wireframes

## 🎨 **Component Visual Structure**

### **1. MedicalHistoryCard - Collapsed State**
```
┌─────────────────────────────────────────────────────────────┐
│ [#1] [🏥] Medical Document Analysis        [📅 Aug 1, 2025] │
│                                                    [▶ Expand] │
├─────────────────────────────────────────────────────────────┤
│ Quick Preview:                                              │
│ • Diagnosis: Laboratory Results                             │
│ • Status: Completed ✓                                      │
└─────────────────────────────────────────────────────────────┘
```

### **2. MedicalHistoryCard - Expanded State**
```
┌─────────────────────────────────────────────────────────────┐
│ [#1] [🏥] Medical Document Analysis        [📅 Aug 1, 2025] │
│                                                   [▼ Collapse] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 🩺 SYMPTOMS ANALYZED                                        │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Patient reported chest pain and shortness of breath    │ │
│ │ during routine examination                              │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 📊 LAB RESULTS DETAILS                          [▼ Expand] │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 1. Blood Pressure: 140/90 mmHg                         │ │
│ │ 2. Heart Rate: 85 bpm                                  │ │
│ │ 3. Cholesterol: 220 mg/dL                              │ │
│ │ 4. Glucose: 95 mg/dL                                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 💊 TREATMENT RECOMMENDATIONS                                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 1. Monitor blood pressure daily                        │ │
│ │ 2. Reduce sodium intake                                 │ │
│ │ 3. Schedule follow-up in 2 weeks                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 📝 CLINICAL NOTES                                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Patient appears stable. Recommend lifestyle changes    │ │
│ │ and continued monitoring.                               │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### **3. UnifiedTimeline Component**
```
┌─────────────────────────────────────────────────────────────┐
│ 📅 PATIENT TIMELINE                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ● Aug 1, 2025                                              │
│ │ [📄] Document Uploaded: Lab Results                      │
│ │ [🔬] Analysis Completed: Blood work processed            │
│ │                                                          │
│ ● Jul 28, 2025                                             │
│ │ [👨‍⚕️] Routine Visit: Annual checkup                        │
│ │ [📝] Visit Notes: Patient reports feeling well           │
│ │                                                          │
│ ● Jul 15, 2025                                             │
│ │ [💊] Prescription Updated: Blood pressure medication     │
│ │                                                          │
│ ● Jun 1, 2025                                              │
│ │ [👥] Patient Registered: Initial registration            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### **4. MedicalCategorySection Component**
```
┌─────────────────────────────────────────────────────────────┐
│ 🩺 SYMPTOMS ANALYZED                                        │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ▲ Primary Symptoms                                      │ │
│ │ • Chest pain (pressure-like sensation)                 │ │
│ │ • Shortness of breath during exertion                  │ │
│ │ • Mild fatigue                                          │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### **5. NumberedRecommendationsList Component**
```
┌─────────────────────────────────────────────────────────────┐
│ 💊 TREATMENT RECOMMENDATIONS                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─── 1. IMMEDIATE ACTIONS ─────────────────────────────────┐ │
│ │ • Monitor blood pressure twice daily                   │ │
│ │ • Take prescribed medication as directed               │ │
│ │ • Avoid strenuous physical activity                    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─── 2. LIFESTYLE MODIFICATIONS ──────────────────────────┐ │
│ │ • Reduce sodium intake to <2g per day                  │ │
│ │ • Increase physical activity gradually                 │ │
│ │ • Maintain healthy weight                              │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─── 3. FOLLOW-UP CARE ────────────────────────────────────┐ │
│ │ • Schedule appointment in 2 weeks                      │ │
│ │ • Repeat blood work in 1 month                         │ │
│ │ • Contact doctor if symptoms worsen                    │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🌐 **RTL (Hebrew) Layout Examples**

### **Hebrew MedicalHistoryCard - Collapsed**
```
┌─────────────────────────────────────────────────────────────┐
│ [הרחב ◀] [2025 ,1 באוג 📅]        ניתוח מסמך רפואי [🏥] [#1] │
│                                                             │
│                                              :תצוגה מקדימה │
│                                     תוצאות מעבדה :אבחנה • │
│                                              ✓ הושלם :סטטוס • │
└─────────────────────────────────────────────────────────────┘
```

### **Hebrew Timeline**
```
┌─────────────────────────────────────────────────────────────┐
│                                         ציר זמן המטופל 📅 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                                              2025 ,1 באוג ● │
│                      תוצאות מעבדה :מסמך הועלה [📄] │         │
│            עבודת דם עובדה :ניתוח הושלם [🔬] │         │
│                                                          │ │
│                                             2025 ,28 ביול ● │
│                        בדיקה שנתית :ביקור שגרתי [👨‍⚕️] │         │
│           המטופל מרגיש טוב :הערות ביקור [📝] │         │
└─────────────────────────────────────────────────────────────┘
```

## 📱 **Mobile Responsive Wireframes**

### **Mobile MedicalHistoryCard**
```
┌─────────────────────────┐
│ [#1] [🏥]              │
│ Medical Document       │
│ Analysis               │
│                        │
│ [📅 Aug 1, 2025]       │
│ [▶ Expand]             │
├────────────────────────┤
│ Quick Preview:         │
│ • Diagnosis: Lab       │
│   Results              │
│ • Status: Completed ✓  │
└────────────────────────┘
```

### **Mobile Timeline (Stacked)**
```
┌─────────────────────────┐
│ 📅 PATIENT TIMELINE    │
├────────────────────────┤
│                        │
│ ● Aug 1, 2025          │
│   [📄] Document        │
│   Uploaded: Lab        │
│   Results              │
│                        │
│   [🔬] Analysis        │
│   Completed            │
│                        │
│ ● Jul 28, 2025         │
│   [👨‍⚕️] Routine Visit   │
│   Annual checkup       │
│                        │
└────────────────────────┘
```

## 🎨 **Visual States & Interactions**

### **Card Hover State**
```
┌─────────────────────────────────────────────────────────────┐
│ [#1] [🏥] Medical Document Analysis        [📅 Aug 1, 2025] │ ↑
│                                                    [▶ Expand] │ │ Lift
│ ┌─ Subtle shadow increase ─────────────────────────────────┐ │ ↓
│ │ Quick Preview:                                          │ │
│ │ • Diagnosis: Laboratory Results                         │ │
│ │ • Status: Completed ✓                                  │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### **Expand/Collapse Animation**
```
State 1 (Collapsed):     State 2 (Expanding):     State 3 (Expanded):
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ Header          │      │ Header          │      │ Header          │
│ [▶ Expand]      │ ---> │ [▼ Collapse]    │ ---> │ [▼ Collapse]    │
├─────────────────┤      ├─────────────────┤      ├─────────────────┤
│ Quick Preview   │      │ Quick Preview   │      │ Full Content    │
│                 │      │ ┌─────────────┐ │      │ • Symptoms      │
└─────────────────┘      │ │ Expanding   │ │      │ • Lab Results   │
                         │ │ Content...  │ │      │ • Treatment     │
                         │ └─────────────┘ │      │ • Notes         │
                         └─────────────────┘      └─────────────────┘
```

### **Loading States**
```
┌─────────────────────────────────────────────────────────────┐
│ [#1] [🏥] Loading Medical Data...          [📅 Aug 1, 2025] │
│                                                    [⏳ Wait] │
├─────────────────────────────────────────────────────────────┤
│ ┌─ Loading Animation ─────────────────────────────────────┐ │
│ │ ████████████████████████████████████████████████████    │ │
│ │ Processing medical document...                          │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### **Error States**
```
┌─────────────────────────────────────────────────────────────┐
│ [#1] [🏥] Error Loading Data               [📅 Aug 1, 2025] │
│                                                   [🔄 Retry] │
├─────────────────────────────────────────────────────────────┤
│ ┌─ Error Message ─────────────────────────────────────────┐ │
│ │ ⚠️ Unable to parse medical data                         │ │
│ │ Please check the document format and try again.        │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 **Component Integration Points**

### **With NewVisit Component**
```
┌─────────────────────────────────────────────────────────────┐
│ 📝 NEW VISIT ENTRY                         [📅 Today]      │
├─────────────────────────────────────────────────────────────┤
│ Visit Type: [Routine ▼]                                    │
│ Chief Complaint: [Text input...]                           │
│ Assessment: [Text input...]                                │
│ Plan: [Text input...]                                      │
│                                                             │
│ [Cancel] [Save Visit] ← Integrates with timeline           │
└─────────────────────────────────────────────────────────────┘
```

### **With Document Upload**
```
┌─────────────────────────────────────────────────────────────┐
│ 📄 DOCUMENT PROCESSING                                      │
├─────────────────────────────────────────────────────────────┤
│ 1. Document uploaded ✓                                     │
│ 2. AI analysis in progress... ⏳                           │
│ 3. Medical history extraction pending                      │
│                                                             │
│ → Will appear in timeline when complete                    │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 **Implementation Priority**

### **Phase 1: Core Components**
1. MedicalHistoryCard (collapsed/expanded)
2. Basic timeline structure
3. Translation key integration

### **Phase 2: Enhanced Features**
1. Numbered recommendations
2. Medical category sections
3. Mobile responsive design

### **Phase 3: Advanced Interactions**
1. Smooth animations
2. Loading/error states
3. Integration with NewVisit
