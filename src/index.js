/**
 * ai-guardrails
 * Safety guardrails for AI outputs with configurable content checks.
 * @module ai-guardrails
 */

class AIGuardrails {
  constructor(options = {}) {
    this.callAI = options.callAI;
    this.rules = options.rules || AIGuardrails.defaultRules();
    this.onViolation = options.onViolation || null;
    if (!this.callAI) throw new Error('callAI function is required');
  }

  static defaultRules() {
    return [
      { name: 'pii-email', check: (text) => { const pattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g; const matches = text.match(pattern); return matches ? { violation: true, details: 'Contains email addresses: ' + matches.length } : { violation: false }; }},
      { name: 'pii-phone', check: (text) => { const pattern = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g; const matches = text.match(pattern); return matches ? { violation: true, details: 'Contains phone numbers: ' + matches.length } : { violation: false }; }},
      { name: 'pii-ssn', check: (text) => { const pattern = /\b\d{3}-\d{2}-\d{4}\b/g; const matches = text.match(pattern); return matches ? { violation: true, details: 'Contains SSN-like patterns' } : { violation: false }; }},
      { name: 'max-length', check: (text) => text.length > 50000 ? { violation: true, details: 'Output exceeds 50000 chars' } : { violation: false } }
    ];
  }

  async generate(prompt, options = {}) {
    const inputCheck = this.checkInput(prompt);
    if (inputCheck.violations.length > 0 && options.blockOnInputViolation) {
      return { success: false, blocked: true, stage: 'input', violations: inputCheck.violations, output: null };
    }

    const output = await this.callAI(prompt, options.systemPrompt || '');
    const outputCheck = this.checkOutput(output);

    if (outputCheck.violations.length > 0) {
      if (this.onViolation) await this.onViolation(outputCheck.violations, output);
      if (options.blockOnOutputViolation) {
        return { success: false, blocked: true, stage: 'output', violations: outputCheck.violations, output: null };
      }
    }

    return { success: true, blocked: false, output, violations: outputCheck.violations };
  }

  checkInput(text) {
    return this._runChecks(text);
  }

  checkOutput(text) {
    return this._runChecks(text);
  }

  _runChecks(text) {
    const violations = [];
    for (const rule of this.rules) {
      try {
        const result = rule.check(text);
        if (result.violation) {
          violations.push({ rule: rule.name, details: result.details });
        }
      } catch (e) {
        violations.push({ rule: rule.name, details: 'Check error: ' + e.message });
      }
    }
    return { violations, clean: violations.length === 0 };
  }

  addRule(name, checkFn) {
    this.rules.push({ name, check: checkFn });
    return this;
  }
}

module.exports = AIGuardrails;