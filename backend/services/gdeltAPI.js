const axios = require('axios');

class GDELTAPIService {
  constructor() {
    this.baseUrl = 'https://api.gdeltproject.org/api/v2';
  }

  async searchEvents(claim) {
    try {
      const keywords = this.extractKeywords(claim);
      const query = keywords.slice(0, 25).join(' ');  // Reduced from 20 to 15

      console.log(`      🔍 Searching GDELT for: "${query}"`);

      const docUrl = `${this.baseUrl}/doc/doc`;
      
      const response = await axios.get(docUrl, {
        params: {
          query: query,
          mode: 'artlist',
          maxrecords: 20,  // Reduced from 20 to 10
          format: 'json',
          sort: 'hybridrel'
        },
        timeout: 15000,  // Reduced timeout
        headers: {
          'User-Agent': 'FactCheckSystem/1.0 Educational'
        }
      });

      if (!response.data || !response.data.articles || response.data.articles.length === 0) {
        console.log('      ⚠️  No GDELT articles found');
        return [];
      }

      const events = [];

      // Process 2 articles instead of 3 for faster response
      const articlesToProcess = response.data.articles.slice(0, 2);
      
      for (const article of articlesToProcess) {
        const relevance = this.calculateRelevance(claim, article.title + ' ' + (article.seendate || ''));

        events.push({
          name: `GDELT: ${article.title}`,
          type: 'global-events',
          verdict: 'REPORTED',
          confidence: relevance,
          url: article.url,
          hasEvidence: true,
          excerpt: article.title,
          fullText: `GDELT Global Event Report:\n\nTitle: ${article.title}\n\nSource: ${article.domain}\nSeen Date: ${article.seendate}\nLanguage: ${article.language}\nSocial Image: ${article.socialimage || 'N/A'}\n\nURL: ${article.url}`,
          metadata: {
            domain: article.domain,
            seendate: article.seendate,
            language: article.language,
            socialimage: article.socialimage,
            tone: article.tone
          }
        });
      }

      console.log(`      ✅ Found ${events.length} GDELT event source(s)`);
      return events;
    } catch (error) {
      console.error('      ❌ GDELT API error:', error.message);
      return [];
    }
  }

  extractKeywords(text) {
    const stopWords = new Set(['is', 'the', 'of', 'and', 'are', 'was', 'were', 'for', 'in', 'on', 'with', 'a', 'an']);
    return text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w));
  }

  calculateRelevance(claim, eventText) {
    const claimWords = this.extractKeywords(claim);
    const eventLower = eventText.toLowerCase();

    const matchedWords = claimWords.filter(w => eventLower.includes(w));
    const relevance = claimWords.length > 0 ? (matchedWords.length / claimWords.length) * 100 : 40;

    return Math.round(Math.min(100, Math.max(30, relevance)));
  }
}

module.exports = new GDELTAPIService();