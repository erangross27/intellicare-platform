import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useWorkflowStore from '../../stores/workflowStore';
import { useLanguage } from '../../config/languagesStatic';
import './WorkflowHelper.css';
import CloseIcon from '../icons/CloseIcon';

const WorkflowHelper = ({ onCommandClick }) => {
  const { currentLanguage } = useLanguage();
  const isRTL = currentLanguage === 'he';
  
  const {
    activeWorkflow,
    currentStep,
    isHelperVisible,
    advanceStep,
    jumpToStep,
    toggleHelper,
    cancelWorkflow,
    getProgress,
    getCurrentStepData,
    canGoBack,
    getStepStatus
  } = useWorkflowStore();
  const [expandedSections, setExpandedSections] = useState({});
  const [copiedCommand, setCopiedCommand] = useState(null);

  // Copy command to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(text);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  // Send command directly to chat
  const sendToChat = (command) => {
    if (onCommandClick) {
      onCommandClick(command);
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return '✅';
      case 'current': return '🔵';
      case 'pending': return '⭕';
      default: return '⭕';
    }
  };

  if (!activeWorkflow) {
    return (
      <div className="workflow-helper workflow-helper--empty">
        <div className="workflow-library">
          <h3>📚 Workflow Library</h3>
          <div className="workflow-categories">
            <div className="workflow-category">
              <h4>Patient Workflows</h4>
              <ul>
                <li onClick={() => sendToChat('Start new patient registration')}>
                  New Patient Registration (8 steps)
                </li>
                <li onClick={() => sendToChat('Start patient visit')}>
                  Patient Visit (10 steps)
                </li>
                <li onClick={() => sendToChat('Start telehealth')}>
                  Telehealth Consultation (6 steps)
                </li>
              </ul>
            </div>
            <div className="workflow-category">
              <h4>Clinical Workflows</h4>
              <ul>
                <li onClick={() => sendToChat('Start lab order')}>
                  Lab Order Process (5 steps)
                </li>
                <li onClick={() => sendToChat('Start prescription')}>
                  Prescription Writing (6 steps)
                </li>
                <li onClick={() => sendToChat('Start referral')}>
                  Referral Creation (7 steps)
                </li>
              </ul>
            </div>
            <div className="workflow-category">
              <h4>Daily Routines</h4>
              <ul>
                <li onClick={() => sendToChat('Start morning routine')}>
                  Morning Rounds (5 steps)
                </li>
                <li onClick={() => sendToChat('Start end of day')}>
                  End of Day Wrap-up (6 steps)
                </li>
              </ul>
            </div>
          </div>
          <div className="workflow-hint">
            💡 Click any workflow or type "Start [workflow name]" in chat
          </div>
        </div>
      </div>
    );
  }

  const currentStepData = activeWorkflow.steps[currentStep];
  const progress = Math.round(((currentStep + 1) / activeWorkflow.steps.length) * 100);

  return (
    <div className="workflow-helper">
      {/* Header */}
      <div className="workflow-header">
        <h3>{activeWorkflow.icon} {activeWorkflow.name[currentLanguage] || activeWorkflow.name.en || activeWorkflow.name}</h3>
        <button className="close-btn" onClick={cancelWorkflow}><CloseIcon size={16} /></button>
      </div>

      {/* Progress Bar */}
      <div className="workflow-progress">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="progress-text">
          Step {currentStep + 1} of {activeWorkflow.steps.length} ({progress}%)
        </span>
      </div>

      {/* Steps List */}
      <div className="workflow-steps">
        {activeWorkflow.steps.map((step, index) => {
          const status = getStepStatus(index);
          return (
            <div 
              key={step.id}
              className={`workflow-step workflow-step--${status}`}
              onClick={() => onStepJump && onStepJump(index)}
            >
              <span className="step-icon">{getStatusIcon(status)}</span>
              <span className="step-name">
                {index === currentStep && '→ '}
                {step.name[currentLanguage] || step.name.en || step.name}
                {index === currentStep && ' ← CURRENT'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Current Step Commands */}
      {currentStepData && (
        <div className="current-commands">
          <div className="commands-header">
            <h4>📝 Commands for: {currentStepData.name[currentLanguage] || currentStepData.name.en || currentStepData.name}</h4>
          </div>

          {/* Required Commands */}
          {currentStepData.commands?.filter(c => c.required).length > 0 && (
            <div className="command-section">
              <h5>Required Commands:</h5>
              {currentStepData.commands
                .filter(c => c.required)
                .map((command, idx) => (
                  <CommandCard
                    key={idx}
                    command={command}
                    onCopy={copyToClipboard}
                    onUse={sendToChat}
                    isCopied={copiedCommand === command.template}
                    currentLanguage={currentLanguage}
                  />
                ))}
            </div>
          )}

          {/* Optional Commands */}
          {currentStepData.commands?.filter(c => !c.required).length > 0 && (
            <div className="command-section">
              <h5>Optional Commands:</h5>
              {currentStepData.commands
                .filter(c => !c.required)
                .map((command, idx) => (
                  <CommandCard
                    key={idx}
                    command={command}
                    onCopy={copyToClipboard}
                    onUse={sendToChat}
                    isCopied={copiedCommand === command.template}
                    currentLanguage={currentLanguage}
                  />
                ))}
            </div>
          )}

          {/* Shortcuts */}
          {currentStepData.shortcuts?.length > 0 && (
            <div className="command-section">
              <h5>⚡ Quick Shortcuts:</h5>
              {currentStepData.shortcuts.map((shortcut, idx) => (
                <div key={idx} className="shortcut-card">
                  <div className="shortcut-name">{shortcut.name}</div>
                  <div className="shortcut-command">
                    <code>{shortcut.command}</code>
                    <button 
                      className="use-btn"
                      onClick={() => sendToChat(shortcut.command)}
                    >
                      Use
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Examples */}
          {currentStepData.examples?.length > 0 && (
            <div className="command-section">
              <h5>💡 Examples (click to use):</h5>
              <div className="examples-list">
                {currentStepData.examples.map((example, idx) => (
                  <div 
                    key={idx}
                    className="example-item"
                    onClick={() => sendToChat(example)}
                  >
                    {example}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="workflow-actions">
        <button 
          className="action-btn action-btn--secondary"
          onClick={() => onStepJump && onStepJump(currentStep - 1)}
          disabled={currentStep === 0}
        >
          ← Previous
        </button>
        <button 
          className="action-btn action-btn--secondary"
          onClick={() => sendToChat('Skip this step')}
        >
          Skip Step
        </button>
        <button 
          className="action-btn action-btn--primary"
          onClick={() => onStepJump && onStepJump(currentStep + 1)}
          disabled={currentStep === activeWorkflow.steps.length - 1}
        >
          Next →
        </button>
      </div>

      {/* Help Section */}
      <div className="workflow-help">
        <details>
          <summary>Need Help?</summary>
          <div className="help-content">
            <p>• Copy any command and paste in chat</p>
            <p>• Click "Use" to insert directly</p>
            <p>• Replace [brackets] with actual values</p>
            <p>• Say "help" in chat for assistance</p>
            <p>• Say "skip" to move to next step</p>
          </div>
        </details>
      </div>

      {/* Cancel Workflow */}
      <div className="workflow-footer">
        <button 
          className="cancel-button"
          onClick={cancelWorkflow}
        >
          {currentLanguage === 'he' ? '❌ ביטול תהליך' : '❌ Cancel Workflow'}
        </button>
      </div>
    </div>
  );
};

// Command Card Component
const CommandCard = ({ command, onCopy, onUse, isCopied, currentLanguage = 'en' }) => {
  // Get translated example if it's a translation object
  const getTranslatedText = (text) => {
    if (typeof text === 'object' && text !== null) {
      return text[currentLanguage] || text.en || text;
    }
    return text;
  };
  
  const example = getTranslatedText(command.example);
  
  return (
    <div className="command-card">
      <div className="command-template">
        <code>{command.template}</code>
        {command.required && <span className="required-badge">Required</span>}
      </div>
      {example && (
        <div className="command-example">
          Example: <code>{example}</code>
        </div>
      )}
      <div className="command-actions">
        <button 
          className={`copy-btn ${isCopied ? 'copied' : ''}`}
          onClick={() => onCopy(command.template)}
        >
          {isCopied ? '✓ Copied' : '📋 Copy'}
        </button>
        <button 
          className="use-btn"
          onClick={() => onUse(example || command.template)}
        >
          Use →
        </button>
      </div>
    </div>
  );
};

export default WorkflowHelper;