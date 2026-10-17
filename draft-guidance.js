(function(root, factory) {
  var api = factory(typeof module === 'object' && module.exports ? require('./presend-analysis.js') : root.SocialReceiptAnalysis);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SocialReceiptGuidance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(engine) {
  'use strict';
  var priorities = ['threat','insult','intent-attribution','guilt-pressure','absolute-blame','ambiguous-finality','repeated-apology','agreement-limit','boundary-defense','defensive-proof','resigned-self-reliance','self-reliance','reluctant-agreement','reassurance-pressure','reassurance-seeking'];
  function guide(raw, context, analysis) {
    context = context || {};
    analysis = analysis || engine.analyze(raw, context);
    var n = engine.normalize(raw), goal = context.goal || '';
    var outgoing = context.perspective === 'outgoing';
    var signals = analysis.signals || [];
    var primary = priorities.map(function(id) { return signals.find(function(s) { return s.id === id; }); }).filter(Boolean)[0] || signals[0];
    var result = { analysis: analysis, primary: primary || null, suggestion: '', question: '', next: '', templateId: '', evidence: primary ? primary.evidence : [] };
    if (!analysis.supported) { result.question = analysis.summary; result.next = result.question; return result; }
    if (!outgoing) {
      result.question = context.perspective === 'received'
        ? 'What do you want your reply to do? Wording alone cannot establish the other person’s intent.'
        : 'Are these your outgoing words, a message you received, or an exchange? Choose whose words these are before using a suggested message.';
      result.next = result.question;
      return result;
    }
    // New templates are English-only. Other packs retain their existing grounded rewrite path.
    if (analysis.language !== 'en') return result;
    if (context.urgency === 'urgent') {
      result.next = 'Use the relevant urgent contact or workplace procedure. This wording check cannot decide whether it is safe to wait.';
    }
    function offer(id, text) { result.templateId = id; result.suggestion = text; }
    var has = function(id) { return signals.some(function(s) { return s.id === id; }); };
    if (has('threat') || has('insult')) {
      result.question = 'What specific concern or limit do you need to communicate without threats or insults?';
    } else if (has('ambiguous-finality')) {
      if (goal === 'pause') offer('pause', 'I need to pause this conversation. [Say when you can return, if you know].');
      else if (goal === 'end') offer('end', 'I want to end [name what you are ending]. [State any practical next step].');
      else result.question = 'Do you mean pause this conversation, end the relationship, or finish a task? Choose a specific goal before rewriting.';
    } else if (has('deflective-apology')) {
      offer('accountability', "I'm sorry I [name what you did]. [Add a repair you can actually keep].");
    } else if (goal === 'confirm' && (has('intent-attribution') || has('reassurance-seeking'))) {
      offer('confirm-plan', 'Are we still on for [the plan and time]?');
    } else if ((goal === 'decline' || goal === 'boundary') && (has('boundary-defense') || has('boundary-setting'))) {
      // Preserve an actual refusal, including its subject and any obligation-specific context.
      var refusal = String(raw).replace(/[’]/g,"'").match(/\bI (?:can't|cannot|am not available|am unavailable|won't be able to)\b[^.!?]+[.!?]?/i);
      if (refusal) {
        var first = refusal[0].split(/,\s*(?:but|because|and I know)|\.\s/)[0].trim().replace(/[.!?]+$/, '');
        offer('direct-limit', first.charAt(0).toUpperCase() + first.slice(1) + '. [Keep any details required for this responsibility].');
      }
    } else if (goal === 'repair' && (has('repeated-apology') || has('reassurance-seeking') || has('accountability-apology'))) {
      offer('repair', "I'm sorry for [the specific action]. [Name a repair you can keep]. You do not need to reassure me right now.");
    } else if (goal === 'help' && (has('resigned-self-reliance') || has('self-reliance'))) {
      offer('help-request', 'I need help with [the task]. Can you [the specific help you need]?');
    } else if (goal === 'input' && has('reluctant-agreement')) {
      offer('shared-decision', 'Before we decide, I want to explain what matters to me about [the plan].');
    } else if (goal === 'feedback' && has('defensive-proof')) {
      offer('feedback', "Can you clarify which part needs changing and what you'd like the finished result to look like?");
    } else if (goal === 'connection' && has('guilt-pressure')) {
      offer('connection', 'I want to spend time with you. Can we choose [a time that works for both of us]?');
    } else if (goal === 'alternative' && has('agreement-limit')) {
      offer('alternative', "That time doesn't work for me. I can do [a time you are actually available].");
    } else if (has('absolute-blame') && (goal === 'request' || goal === 'clarify')) {
      offer('specific-concern', 'When [the specific event] happened, I felt [your feeling]. Can we [your specific request]?');
    } else if (has('resigned-self-reliance') && !goal) {
      var literal = String(raw).match(/^(?:fine[.!?,]\s*)?(i(?:'ll|’ll| will) (?:do|handle|cover) (?:it|this) myself)[, ]+(?:like always|as usual)[.!?]?$/i);
      if (literal) offer('literal-action', literal[1].charAt(0).toUpperCase() + literal[1].slice(1) + '.');
      else result.question = 'Do you want help, or do you intend to take on this task? Choose your goal before rewriting.';
    } else if (has('reassurance-seeking') && goal === 'clarify' && /\b(?:talk|discuss|prepared)\b/.test(n)) {
      offer('clarify', "Could you clarify what you'd like to discuss so I can come prepared?");
    } else if (primary && primary.kind !== 'positive') {
      result.question = 'What do you want this message to do? Select a goal so an alternative can keep your meaning.';
    }
    // A wording option must be tied to a selected goal and actual evidence, never a scenario-only reply.
    if (result.suggestion && ((!goal && result.templateId !== 'literal-action' && result.templateId !== 'accountability') || !primary || engine.normalize(result.suggestion) === n)) result.suggestion = '';
    if (!result.next) result.next = result.question || (result.suggestion ? 'Fill in bracketed details with true facts. Compare this option with your intention before sending.' : 'Keep the details that matter to your goal. No grounded alternative was selected for this wording.');
    return result;
  }
  return { guide: guide };
});
