class RiskCalculation {
  calculate(sourceResults, propagandaResults) {
    console.log('📊 Calculating risk score...');
    
    const weights = {
      sourceVerification: 0.4,
      emotional: 0.2,
      fear: 0.2,
      bias: 0.2
    };

    // Source verification score (inverted - higher confidence = lower risk)
    const sourceScore = 100 - sourceResults.confidence;
    
    // Propaganda scores
    const propagandaScore = (
      propagandaResults.emotionalLanguage * weights.emotional +
      propagandaResults.fearBased * weights.fear +
      propagandaResults.bias * weights.bias
    ) / (weights.emotional + weights.fear + weights.bias);

    // Combined risk score
    const riskScore = (
      sourceScore * weights.sourceVerification +
      propagandaScore * (1 - weights.sourceVerification)
    );

    return Math.round(Math.min(Math.max(riskScore, 0), 100));
  }

  generateExplanation(sourceResults, propagandaResults) {
    const explanations = [];

    // Source verification explanations
    if (sourceResults.confidence < 30) {
      explanations.push('Claim not confirmed by any reliable source');
      explanations.push('No supporting reports from reputed media outlets');
    } else if (sourceResults.confidence < 60) {
      explanations.push('Limited verification from trusted sources');
    }

    // Propaganda explanations
    if (propagandaResults.emotionalLanguage > 60) {
      explanations.push('Strong emotional and manipulative language detected');
    }

    if (propagandaResults.fearBased > 60) {
      explanations.push('Fear-based language indicating potential propaganda tactics');
    }

    if (propagandaResults.bias > 60) {
      explanations.push('Extreme statements and biased framing detected');
    }

    // General explanations
    if (sourceResults.sources.length === 0) {
      explanations.push('No credible sources available for verification');
    }

    if (explanations.length === 0) {
      explanations.push('Content appears relatively neutral with some source verification');
    }

    return explanations;
  }
}

module.exports = new RiskCalculation();