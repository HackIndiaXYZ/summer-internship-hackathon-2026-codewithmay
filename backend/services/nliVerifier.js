const { HfInference } = require('@huggingface/inference');

class NLIVerifier {
  constructor() {
    this.hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
    this.model = 'facebook/bart-large-mnli';
  }

  async verifyClaimAgainstEvidence(claim, evidence) {
    try {
      console.log('🧠 Running NLI verification...');

      if (!evidence || evidence.trim().length === 0) {
        return {
          label: 'NEUTRAL',
          confidence: 0,
          reason: 'No evidence available for comparison'
        };
      }

      // Format: premise (evidence) vs hypothesis (claim)
      const input = `${evidence} </s> ${claim}`;

      const result = await this.hf.textClassification({
        model: this.model,
        inputs: input
      });

      // Result format: [{ label: 'entailment/contradiction/neutral', score: 0.XX }]
      const prediction = result.reduce((max, curr) => 
        curr.score > max.score ? curr : max
      );

      const label = prediction.label.toUpperCase();
      const confidence = prediction.score;

      console.log(`✅ NLI Result: ${label} (${(confidence * 100).toFixed(1)}%)`);

      return {
        label,
        confidence,
        allScores: result,
        reason: this.explainNLI(label, confidence)
      };

    } catch (error) {
      console.error('❌ NLI verification error:', error);
      return {
        label: 'NEUTRAL',
        confidence: 0,
        reason: 'NLI verification failed',
        error: true
      };
    }
  }

  explainNLI(label, confidence) {
    if (label === 'ENTAILMENT') {
      return 'The evidence supports the claim';
    } else if (label === 'CONTRADICTION') {
      return 'The evidence contradicts the claim';
    } else {
      return 'The evidence is neutral or unrelated to the claim';
    }
  }
}

module.exports = new NLIVerifier();