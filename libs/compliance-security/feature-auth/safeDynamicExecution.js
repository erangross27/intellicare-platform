// Safe alternatives to eval() and Function()
class SafeDynamicExecution {

  async initialize() {
    if (!this.serviceToken) {
      this.serviceToken = await serviceAccountManager.authenticate('safe-dynamic-execution');
    }
    return this;
  }
  // Instead of eval(expression)
  evaluateExpression(expression, context = {}) {
    // Parse and evaluate safely
    if (typeof expression !== 'string') {
      throw new Error('Expression must be a string');
    }

    // Handle simple math expressions
    if (/^[0-9\s+\-*/().]+$/.test(expression)) {
      try {
        // Safe math evaluation without eval
        const result = this.evaluateMath(expression);
        return result;
      } catch (error) {
        throw new Error('Invalid mathematical expression');
      }
    }

    // Handle JSON parsing
    if (expression.trim().startsWith('{') || expression.trim().startsWith('[')) {
      try {
        return JSON.parse(expression);
      } catch (error) {
        throw new Error('Invalid JSON expression');
      }
    }

    throw new Error('Unsafe expression - cannot evaluate');
  }

  evaluateMath(expr) {
    // Remove spaces
    expr = expr.replace(/\s/g, '');
    
    // Basic math parser without eval
    const operators = {
      '+': (a, b) => a + b,
      '-': (a, b) => a - b,
      '*': (a, b) => a * b,
      '/': (a, b) => a / b
    };

    // Simple two-operand expressions
    for (const op in operators) {
      if (expr.includes(op)) {
        const parts = expr.split(op);
        if (parts.length === 2) {
          const left = parseFloat(parts[0]);
          const right = parseFloat(parts[1]);
          if (!isNaN(left) && !isNaN(right)) {
            return operators[op](left, right);
          }
        }
      }
    }

    // Single number
    const num = parseFloat(expr);
    if (!isNaN(num)) {
      return num;
    }

    throw new Error('Cannot evaluate expression');
  }

  // Instead of new Function()
  createSafeFunction(functionName, args = []) {
    // Create predefined safe functions
    const safeFunctions = {
      'add': (a, b) => a + b,
      'subtract': (a, b) => a - b,
      'multiply': (a, b) => a * b,
      'divide': (a, b) => b !== 0 ? a / b : null,
      'concat': (a, b) => String(a) + String(b),
      'compare': (a, b) => a === b,
      'greater': (a, b) => a > b,
      'lesser': (a, b) => a < b
    };

    // Check if body matches a safe function
    const funcName = body.trim().toLowerCase();
    if (safeFunctions[funcName]) {
      return safeFunctions[funcName];
    }

    // Return no-op function for unknown operations
    console.warn('Unknown function requested:', body);
    return () => null;
  }

  // Safe template evaluation
  evaluateTemplate(template, context = {}) {
    // Replace template variables safely
    return template.replace(/{{(w+)}}/g, (match, key) => {
      if (key in context) {
        return String(context[key]);
      }
      return match;
    });
  }
}

module.exports = new SafeDynamicExecution();
