const axios = require('axios');

class SourceVerification {
  async verifyClaim(text) {
    const results = {
      verified: false,
      sources: [],
      confidence: 0
    };

    console.log('🔍 Starting source verification...');

    // Check NewsAPI (if API key exists)
    if (process.env.NEWS_API_KEY) {
      try {
        const newsData = await this.checkNewsAPI(text);
        results.sources.push(...newsData);
      } catch (error) {
        console.log('⚠️ NewsAPI check failed:', error.message);
      }
    } else {
      console.log('ℹ️ NewsAPI key not found, skipping...');
    }

    // Add government sources (simulated for MVP)
    const govSources = this.getGovernmentSources();
    results.sources.push(...govSources);

    // Add media sources (simulated for MVP)
    const mediaSources = this.getMediaSources();
    results.sources.push(...mediaSources);

    // Calculate verification confidence
    const verifiedCount = results.sources.filter(s => s.verified).length;
    results.confidence = results.sources.length > 0 
      ? (verifiedCount / results.sources.length) * 100 
      : 0;
    results.verified = results.confidence > 50;

    console.log(`✅ Source verification complete. Confidence: ${results.confidence.toFixed(1)}%`);
    return results;
  }

  async checkNewsAPI(text) {
    try {
      const keywords = this.extractKeywords(text);
      const response = await axios.get('https://newsapi.org/v2/everything', {
        params: {
          q: keywords.slice(0, 3).join(' OR '),
          apiKey: process.env.NEWS_API_KEY,
          pageSize: 5,
          language: 'en',
          sortBy: 'relevancy'
        },
        timeout: 5000
      });

      if (response.data.articles && response.data.articles.length > 0) {
        return response.data.articles.slice(0, 3).map(article => ({
          name: article.source.name || 'News Source',
          verified: this.checkSimilarity(text, article.title + ' ' + (article.description || '')) > 0.3,
          url: article.url
        }));
      }
    } catch (error) {
      console.log('NewsAPI error:', error.message);
    }
    return [];
  }

  getGovernmentSources() {
    return [
      {
        name: 'Government Press Release Portal',
        verified: false,
        url: 'https://pib.gov.in'
      },
      {
        name: 'Ministry Information Database',
        verified: false,
        url: '#'
      }
    ];
  }

  getMediaSources() {
    return [
      {
        name: 'Reuters News Archive',
        verified: false,
        url: 'https://reuters.com'
      },
      {
        name: 'Associated Press',
        verified: false,
        url: 'https://apnews.com'
      }
    ];
  }

  extractKeywords(text) {
    const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'for']);
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));
    
    return [...new Set(words)].slice(0, 5);
  }

  checkSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }
}

module.exports = new SourceVerification();