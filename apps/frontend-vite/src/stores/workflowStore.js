// Zustand Store for Workflow Management
import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';

const useWorkflowStore = create(
  devtools(
    persist(
      subscribeWithSelector((set, get) => ({
        // ============= STATE =============
        activeWorkflow: null,
        currentStep: 0,
        completedSteps: [],
        stepData: {},
        isHelperVisible: false,
        workflowHistory: [],
        userLevel: 'beginner', // beginner, intermediate, advanced, expert
        commandHistory: [],
        
        // ============= ACTIONS =============
        startWorkflow: (workflow) => {
          console.log('🚀 Starting workflow:', workflow.name);
          set({
            activeWorkflow: workflow,
            currentStep: 0,
            completedSteps: [],
            stepData: {},
            isHelperVisible: true
          });
          
          // Emit to backend
          if (window.workflowSocketService) {
            window.workflowSocketService.emit('workflow:start', { 
              workflowId: workflow.id 
            });
          }
        },
        
        advanceStep: () => {
          const { currentStep, activeWorkflow, completedSteps } = get();
          
          if (!activeWorkflow) return;
          
          if (currentStep < activeWorkflow.steps.length - 1) {
            const nextStep = currentStep + 1;
            console.log(`➡️ Advancing to step ${nextStep}`);
            
            set({
              currentStep: nextStep,
              completedSteps: [...completedSteps, currentStep]
            });
            
            // Emit to backend
            if (window.workflowSocketService) {
              window.workflowSocketService.emit('workflow:advance', {
                workflowId: activeWorkflow.id,
                step: nextStep
              });
            }
          } else {
            // Workflow complete
            get().completeWorkflow();
          }
        },
        
        jumpToStep: (stepIndex) => {
          const { activeWorkflow } = get();
          
          if (!activeWorkflow || stepIndex < 0 || stepIndex >= activeWorkflow.steps.length) {
            return;
          }
          
          console.log(`⤴️ Jumping to step ${stepIndex}`);
          set({ currentStep: stepIndex });
        },
        
        updateStepData: (stepId, data) => {
          set(state => ({
            stepData: {
              ...state.stepData,
              [stepId]: {
                ...state.stepData[stepId],
                ...data,
                updatedAt: new Date().toISOString()
              }
            }
          }));
        },
        
        completeWorkflow: () => {
          const { activeWorkflow, stepData, completedSteps } = get();
          
          if (!activeWorkflow) return;
          
          console.log('✅ Workflow completed:', activeWorkflow.name);
          
          // Add to history
          const completedWorkflow = {
            ...activeWorkflow,
            completedAt: new Date().toISOString(),
            duration: Date.now() - new Date(stepData[activeWorkflow.steps[0].id]?.startedAt || Date.now()),
            completedSteps,
            data: stepData
          };
          
          set(state => ({
            workflowHistory: [...state.workflowHistory, completedWorkflow],
            activeWorkflow: null,
            currentStep: 0,
            completedSteps: [],
            stepData: {},
            isHelperVisible: false
          }));
          
          // Emit to backend
          if (window.workflowSocketService) {
            window.workflowSocketService.emit('workflow:complete', {
              workflowId: activeWorkflow.id,
              data: stepData
            });
          }
        },
        
        cancelWorkflow: () => {
          const { activeWorkflow } = get();
          
          if (activeWorkflow) {
            console.log('❌ Workflow cancelled:', activeWorkflow.name);
            
            if (window.workflowSocketService) {
              window.workflowSocketService.emit('workflow:cancel', {
                workflowId: activeWorkflow.id
              });
            }
          }
          
          set({
            activeWorkflow: null,
            currentStep: 0,
            completedSteps: [],
            stepData: {},
            isHelperVisible: false
          });
        },
        
        updateWorkflow: (updates) => {
          const { activeWorkflow } = get();
          if (!activeWorkflow) return;
          
          console.log('🔄 Updating workflow:', updates);
          set({
            activeWorkflow: {
              ...activeWorkflow,
              ...updates
            }
          });
        },
        
        updateWorkflowStep: (stepId, updates) => {
          const { activeWorkflow } = get();
          if (!activeWorkflow) return;
          
          const updatedSteps = activeWorkflow.steps.map(step => 
            step.id === stepId 
              ? { ...step, ...updates }
              : step
          );
          
          set({
            activeWorkflow: {
              ...activeWorkflow,
              steps: updatedSteps
            }
          });
        },
        
        toggleHelper: () => {
          set(state => ({ 
            isHelperVisible: !state.isHelperVisible 
          }));
        },
        
        hideHelper: () => {
          set({ isHelperVisible: false });
        },
        
        showHelper: () => {
          set({ isHelperVisible: true });
        },
        
        addCommandToHistory: (command) => {
          set(state => ({
            commandHistory: [
              ...state.commandHistory,
              {
                command,
                timestamp: new Date().toISOString(),
                workflowId: state.activeWorkflow?.id,
                step: state.currentStep
              }
            ].slice(-50) // Keep last 50 commands
          }));
        },
        
        updateUserLevel: (level) => {
          set({ userLevel: level });
        },
        
        // ============= COMPUTED GETTERS =============
        getProgress: () => {
          const { currentStep, activeWorkflow } = get();
          if (!activeWorkflow) return 0;
          return Math.round(((currentStep + 1) / activeWorkflow.steps.length) * 100);
        },
        
        getCurrentStepData: () => {
          const { activeWorkflow, currentStep } = get();
          if (!activeWorkflow) return null;
          return activeWorkflow.steps[currentStep];
        },
        
        canAdvance: () => {
          const { activeWorkflow, currentStep, stepData } = get();
          if (!activeWorkflow) return false;
          
          const currentStepInfo = activeWorkflow.steps[currentStep];
          const requiredCommands = currentStepInfo.commands.filter(c => c.required);
          
          // Check if all required fields have data
          return requiredCommands.every(cmd => {
            const data = stepData[currentStepInfo.id];
            return data && data[cmd.field];
          });
        },
        
        canGoBack: () => {
          const { currentStep } = get();
          return currentStep > 0;
        },
        
        getStepStatus: (stepIndex) => {
          const { currentStep, completedSteps } = get();
          
          if (stepIndex < currentStep || completedSteps.includes(stepIndex)) {
            return 'completed';
          }
          if (stepIndex === currentStep) {
            return 'current';
          }
          return 'pending';
        },
        
        // ============= PERSISTENCE HELPERS =============
        restoreSession: () => {
          const { activeWorkflow } = get();
          
          if (activeWorkflow && window.workflowSocketService) {
            console.log('🔄 Restoring workflow session');
            window.workflowSocketService.emit('workflow:restore', {
              workflowId: activeWorkflow.id,
              currentStep: get().currentStep,
              stepData: get().stepData
            });
          }
        },
        
        clearHistory: () => {
          set({
            workflowHistory: [],
            commandHistory: []
          });
        }
      })),
      {
        name: 'workflow-storage',
        version: 2, // Increment this to force clear old data
        migrate: (persistedState, version) => {
          // Clear old workflow when version changes
          if (version !== 2) {
            return {
              activeWorkflow: null,
              currentStep: 0,
              completedSteps: [],
              stepData: {},
              userLevel: 'beginner',
              workflowHistory: []
            };
          }
          return persistedState;
        },
        partialize: (state) => ({
          activeWorkflow: state.activeWorkflow,
          currentStep: state.currentStep,
          completedSteps: state.completedSteps,
          stepData: state.stepData,
          userLevel: state.userLevel,
          workflowHistory: state.workflowHistory.slice(-10) // Keep last 10
        })
      }
    )
  )
);

// ============= SUBSCRIPTIONS =============
// Auto-save step data when advancing
useWorkflowStore.subscribe(
  (state) => state.currentStep,
  (currentStep, previousStep) => {
    if (currentStep !== previousStep) {
      console.log(`📍 Step changed: ${previousStep} → ${currentStep}`);
    }
  }
);

// Track user level based on usage
useWorkflowStore.subscribe(
  (state) => state.workflowHistory,
  (history) => {
    const completedCount = history.length;
    const { updateUserLevel } = useWorkflowStore.getState();
    
    if (completedCount >= 50) {
      updateUserLevel('expert');
    } else if (completedCount >= 20) {
      updateUserLevel('advanced');
    } else if (completedCount >= 5) {
      updateUserLevel('intermediate');
    }
  }
);

export default useWorkflowStore;