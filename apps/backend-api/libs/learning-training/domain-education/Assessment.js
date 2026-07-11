/**
 * Assessment Entity
 * Represents competency assessments and evaluations
 */

class Assessment {
  constructor({
    id,
    title,
    description,
    type, // quiz, practical, observation, portfolio
    category, // medical, technical, compliance
    questions = [],
    passingScore = 80,
    timeLimit, // in minutes
    maxAttempts = 3,
    prerequisites = [],
    tags = [],
    status = 'draft', // draft, published, archived
    createdBy,
    createdAt = new Date(),
    updatedAt = new Date()
  }) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.type = type;
    this.category = category;
    this.questions = questions;
    this.passingScore = passingScore;
    this.timeLimit = timeLimit;
    this.maxAttempts = maxAttempts;
    this.prerequisites = prerequisites;
    this.tags = tags;
    this.status = status;
    this.createdBy = createdBy;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  addQuestion(question) {
    this.questions.push({
      ...question,
      id: question.id || this.generateQuestionId(),
      order: this.questions.length + 1
    });
    this.updatedAt = new Date();
  }

  removeQuestion(questionId) {
    this.questions = this.questions.filter(q => q.id !== questionId);
    this.reorderQuestions();
    this.updatedAt = new Date();
  }

  reorderQuestions() {
    this.questions.forEach((question, index) => {
      question.order = index + 1;
    });
  }

  calculateScore(answers) {
    if (this.questions.length === 0) return 0;
    
    let correctAnswers = 0;
    
    this.questions.forEach(question => {
      const userAnswer = answers[question.id];
      if (this.isAnswerCorrect(question, userAnswer)) {
        correctAnswers++;
      }
    });
    
    return Math.round((correctAnswers / this.questions.length) * 100);
  }

  isAnswerCorrect(question, userAnswer) {
    switch (question.type) {
      case 'multiple-choice':
        return question.correctAnswer === userAnswer;
      case 'multiple-select':
        return JSON.stringify(question.correctAnswers?.sort()) === 
               JSON.stringify(userAnswer?.sort());
      case 'true-false':
        return question.correctAnswer === userAnswer;
      case 'text':
        return this.compareTextAnswer(question.correctAnswer, userAnswer);
      default:
        return false;
    }
  }

  compareTextAnswer(correct, userAnswer) {
    if (!correct || !userAnswer) return false;
    
    const normalize = (text) => text.toLowerCase().trim();
    return normalize(correct) === normalize(userAnswer);
  }

  isPassed(score) {
    return score >= this.passingScore;
  }

  generateQuestionId() {
    return `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  validate() {
    const errors = [];
    
    if (!this.title) errors.push('Title is required');
    if (!this.type) errors.push('Type is required');
    if (!this.category) errors.push('Category is required');
    if (this.passingScore < 0 || this.passingScore > 100) {
      errors.push('Passing score must be between 0 and 100');
    }
    if (this.maxAttempts < 1) {
      errors.push('Max attempts must be at least 1');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = Assessment;