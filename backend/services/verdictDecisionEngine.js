class VerdictDecisionEngine {
  decide(nliResult, evidence, riskSignal, googleFactCheck) {
    console.log('⚖️ Making final verdict decision...');

    // PRIORITY 1: Google Fact Check (if available)
    if (googleFactCheck?.found) {
      return {
        verdict: googleFactCheck.verdict,
        confidence: 0.90, // High confidence in authoritative fact-checks
        explanation: `This claim has been fact-checked by ${googleFactCheck.publisher}. Their verdict: "${googleFactCheck.rating}".`,
        sources: [{
          name: googleFactCheck.publisher,
          type: 'fact-check',
          url: googleFactCheck.url,
          verdict: googleFactCheck.rating
        }],
        method: 'google_fact_check'
      };
    }

    // PRIORITY 2: NLI with Evidence
    if (!evidence.hasEvidence) {
      return {
        verdict: 'UNCERTAIN',
        confidence: 0.10,
        explanation: 'No reliable evidence found to verify this claim. Unable to confirm or deny.',
        sources: [],
        method: 'no_evidence'
      };
    }

    // Apply strict NLI decision rules
    const nliLabel = nliResult.label;
    const nliConfidence = nliResult.confidence;

    let verdict, confidence, explanation;

    if (nliLabel === 'ENTAILMENT' && nliConfidence >= 0.75) {
      verdict = 'TRUE';
      confidence = nliConfidence;
      explanation = this.buildExplanation('TRUE', evidence.sources, nliResult.reason);
    } 
    else if (nliLabel === 'CONTRADICTION' && nliConfidence >= 0.75) {
      verdict = 'FALSE';
      confidence = nliConfidence;
      explanation = this.buildExplanation('FALSE', evidence.sources, nliResult.reason);
    } 
    else if (nliLabel === 'ENTAILMENT' && nliConfidence >= 0.60) {
      verdict = 'TRUE';
      confidence = nliConfidence;
      explanation = this.buildExplanation('TRUE', evidence.sources, nliResult.reason) + ' Note: Moderate confidence level.';
    }
    else if (nliLabel === 'CONTRADICTION' && nliConfidence >= 0.60) {
      verdict = 'FALSE';
      confidence = nliConfidence;
      explanation = this.buildExplanation('FALSE', evidence.sources, nliResult.reason) + ' Note: Moderate confidence level.';
    }
    else {
      verdict = 'UNCERTAIN';
      confidence = Math.max(nliConfidence, 0.40);
      explanation = `The available evidence is insufficient or inconclusive. ${nliResult.reason}. Further investigation recommended.`;
    }

    // Adjust for low-quality evidence
    const avgReliability = evidence.sources.reduce((sum, s) => sum + (s.reliability || 0.5), 0) / evidence.sources.length;
    
    if (avgReliability < 0.6 && verdict !== 'UNCERTAIN') {
      confidence *= 0.8;
      explanation += ' (Adjusted for evidence quality)';
    }

    // Risk signal is ONLY used as a warning, never to change verdict
    let warning = null;
    if (riskSignal && riskSignal.isSuspicious && verdict === 'TRUE') {
      warning = 'Note: Content shows stylistic patterns common in misinformation, but evidence supports the claim.';
    }

    return {
      verdict,
      confidence: Math.round(confidence * 100) / 100,
      explanation: warning ? `${explanation} ${warning}` : explanation,
      sources: evidence.sources.map(s => ({
        name: s.source,
        type: s.type,
        url: s.url,
        reliability: s.reliability
      })),
      method: 'nli_with_evidence',
      nliDetails: {
        label: nliLabel,
        confidence: nliConfidence,
        allScores: nliResult.allScores
      }
    };
  }

  buildExplanation(verdict, sources, nliReason) {
    const sourceNames = sources.map(s => s.source).join(', ');
    
    if (verdict === 'TRUE') {
      return `The claim is supported by evidence from ${sourceNames}. ${nliReason}.`;
    } else if (verdict === 'FALSE') {
      return `The claim is contradicted by evidence from ${sourceNames}. ${nliReason}.`;
    }
    
    return nliReason;
  }
}

module.exports = new VerdictDecisionEngine();