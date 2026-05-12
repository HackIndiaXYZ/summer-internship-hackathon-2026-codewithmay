class PropagandaDetection {
  analyze(text) {
    console.log('🎭 Analyzing propaganda indicators...');
    
    const results = {
      emotionalLanguage: this.detectEmotionalLanguage(text),
      fearBased: this.detectFearLanguage(text),
      bias: this.detectBias(text)
    };

    console.log('📊 Propaganda scores:', results);
    return results;
  }

  detectEmotionalLanguage(text) {
    const emotionalWords = [
      'shocking', 'unbelievable', 'amazing', 'terrible', 'horrible',
      'outrageous', 'scandal', 'crisis', 'disaster', 'urgent',
      'breaking', 'exclusive', 'sensational', 'alarming', 'devastating'
    ];
    
    const lowerText = text.toLowerCase();
    let count = 0;
    
    emotionalWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) count += matches.length;
    });
    
    const score = Math.min((count / 5) * 100, 100);
    return Math.round(score);
  }

  detectFearLanguage(text) {
    const fearWords = [
      'danger', 'threat', 'warning', 'deadly', 'fatal', 'kill',
      'destroy', 'attack', 'risk', 'fear', 'scary', 'terrifying',
      'panic', 'emergency', 'beware', 'careful'
    ];
    
    const lowerText = text.toLowerCase();
    let count = 0;
    
    fearWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) count += matches.length;
    });
    
    const score = Math.min((count / 5) * 100, 100);
    return Math.round(score);
  }

  detectBias(text) {
    const biasIndicators = [
      'always', 'never', 'everyone', 'nobody', 'all', 'none',
      'definitely', 'obviously', 'clearly', 'undoubtedly',
      'must', 'certainly', 'absolutely', 'completely'
    ];
    
    const lowerText = text.toLowerCase();
    let count = 0;
    
    biasIndicators.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) count += matches.length;
    });
    
    const score = Math.min((count / 5) * 100, 100);
    return Math.round(score);
  }
}

module.exports = new PropagandaDetection();