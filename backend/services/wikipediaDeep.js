const axios = require('axios');

class WikipediaDeepService {
  constructor() {
    this.searchUrl = 'https://en.wikipedia.org/w/api.php';
    this.restUrl = 'https://en.wikipedia.org/api/rest_v1';
  }

  async deepFetch(claim) {
    try {
      const keywords = this.extractKeywords(claim);
      const searchTerm = keywords.slice(0, 20).join(' ');

      console.log(`      🔍 Searching Wikipedia for: "${searchTerm}"`);

      const searchResponse = await axios.get(this.searchUrl, {
        params: {
          action: 'query',
          list: 'search',
          srsearch: searchTerm,
          format: 'json',
          origin: '*',
          srlimit: 3  // Reduced from 5 to 3 for speed
        },
        timeout: 15000,  // Reduced timeout
        headers: { 'User-Agent': 'FactCheckSystem/1.0 Educational' }
      });

      if (!searchResponse.data.query || searchResponse.data.query.search.length === 0) {
        return [];
      }

      const searchResults = searchResponse.data.query.search;
      console.log(`      📄 Fetching ${searchResults.length} Wikipedia articles in parallel...`);

      // Fetch all articles in parallel for speed
      const fetchPromises = searchResults.map(result => 
        this.fetchSingleArticle(result.title, claim)
      );

      const articles = await Promise.allSettled(fetchPromises);

      // Filter out failed requests and extract successful ones
      const results = articles
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => result.value);

      console.log(`      ✅ Successfully fetched ${results.length} Wikipedia sources`);
      return results;
    } catch (error) {
      console.error('      ❌ Wikipedia deep fetch error:', error.message);
      return [];
    }
  }

  async fetchSingleArticle(pageTitle, claim) {
    try {
      const contentResponse = await axios.get(this.searchUrl, {
        params: {
          action: 'query',
          titles: pageTitle,
          prop: 'extracts|info',
          inprop: 'url',
          exintro: false,
          explaintext: true,
          exchars: 2000,  // Limit text size for faster processing
          format: 'json',
          origin: '*'
        },
        timeout: 10000,  // Reduced timeout per article
        headers: { 'User-Agent': 'FactCheckSystem/1.0 Educational' }
      });

      const pages = contentResponse.data.query.pages;
      const pageId = Object.keys(pages)[0];
      const pageData = pages[pageId];

      if (!pageData || !pageData.extract) {
        return null;
      }

      const fullText = pageData.extract;
      const relevance = this.calculateRelevance(claim, fullText, pageTitle);

      return {
        name: `Wikipedia: ${pageTitle}`,
        type: 'encyclopedia',
        verdict: 'CONTEXTUAL',
        confidence: relevance,
        url: pageData.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`,
        hasEvidence: true,
        excerpt: fullText.substring(0, 300),
        fullText: fullText,
        metadata: {
          pageId: pageId,
          title: pageTitle,
          textLength: fullText.length,
          relevance: relevance
        }
      };
    } catch (error) {
      console.error(`      ⚠️  Error fetching "${pageTitle}":`, error.message);
      return null;
    }
  }

  extractKeywords(text) {
    const stopWords = new Set(['is', 'the', 'of', 'and', 'are', 'was', 'were', 'for', 'in', 'on', 'with', 'who', 'what', 'a', 'an', 'to', 'be', 'as']);
    return text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));
  }

  calculateRelevance(claim, articleText, title) {
    const claimLower = claim.toLowerCase();
    const articleLower = articleText.toLowerCase();
    const titleLower = title.toLowerCase();

    const claimWords = this.extractKeywords(claim);
    const matchedWords = claimWords.filter(w => articleLower.includes(w));
    const keywordScore = claimWords.length > 0 ? (matchedWords.length / claimWords.length) * 100 : 0;

    const titleMatchBoost = claimWords.some(w => titleLower.includes(w)) ? 20 : 0;

    let relevance = keywordScore + titleMatchBoost;
    relevance = Math.min(100, Math.max(0, relevance));

    return Math.round(relevance);
  }
}

module.exports = new WikipediaDeepService();