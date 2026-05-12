const axios = require('axios');
const cheerio = require('cheerio');

class EvidenceRetriever {
  constructor() {
    this.timeout = 15000;
  }

  async retrieveEvidence(claim) {
    console.log('🔍 Retrieving evidence for:', claim);

    const results = await Promise.allSettled([
      this.getWikipediaEvidence(claim),
      this.getGovernmentEvidence(claim),
      this.getNewsEvidence(claim)
    ]);

    const evidence = {
      wikipedia: results[0].status === 'fulfilled' ? results[0].value : null,
      government: results[1].status === 'fulfilled' ? results[1].value : null,
      news: results[2].status === 'fulfilled' ? results[2].value : null
    };

    return this.compileEvidence(evidence);
  }

  async getWikipediaEvidence(claim) {
    try {
      // Extract key entities from claim
      const searchTerm = this.extractSearchTerm(claim);
      
      // Search Wikipedia
      const searchUrl = 'https://en.wikipedia.org/w/api.php';
      const searchResponse = await axios.get(searchUrl, {
        params: {
          action: 'query',
          list: 'search',
          srsearch: searchTerm,
          format: 'json',
          origin: '*'
        },
        timeout: this.timeout
      });

      if (!searchResponse.data.query?.search?.[0]) {
        return null;
      }

      const pageTitle = searchResponse.data.query.search[0].title;

      // Get intro + infobox
      const pageResponse = await axios.get(searchUrl, {
        params: {
          action: 'query',
          titles: pageTitle,
          prop: 'extracts|info',
          exintro: true,
          explaintext: true,
          inprop: 'url',
          format: 'json',
          origin: '*'
        },
        timeout: this.timeout
      });

      const pages = pageResponse.data.query.pages;
      const pageId = Object.keys(pages)[0];
      const page = pages[pageId];

      if (!page.extract) return null;

      return {
        source: 'Wikipedia',
        type: 'contextual',
        title: page.title,
        text: page.extract.substring(0, 1000), // First 1000 chars
        url: page.fullurl,
        reliability: 0.7 // Wikipedia is contextual, not primary source
      };

    } catch (error) {
      console.error('Wikipedia error:', error.message);
      return null;
    }
  }

  async getGovernmentEvidence(claim) {
    try {
      // Check PIB Fact Check
      const keywords = this.extractKeywords(claim);
      const searchQuery = `site:factcheck.pib.gov.in ${keywords.join(' ')}`;
      
      // Use DuckDuckGo HTML search
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
      
      const response = await axios.get(searchUrl, {
        timeout: this.timeout,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      const $ = cheerio.load(response.data);
      const results = [];

      $('.result__a').each((i, elem) => {
        if (i < 3) {
          const title = $(elem).text().trim();
          const url = $(elem).attr('href');
          if (url && url.includes('factcheck.pib.gov.in')) {
            results.push({ title, url });
          }
        }
      });

      if (results.length === 0) return null;

      // Fetch the top result content
      const articleResponse = await axios.get(results[0].url, {
        timeout: this.timeout,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      const $article = cheerio.load(articleResponse.data);
      const content = $article('article, .content, .post-content').text().substring(0, 1000);

      return {
        source: 'PIB Fact Check',
        type: 'official',
        title: results[0].title,
        text: content,
        url: results[0].url,
        reliability: 1.0 // Official government source
      };

    } catch (error) {
      console.error('Government evidence error:', error.message);
      return null;
    }
  }

  async getNewsEvidence(claim) {
    try {
      if (!process.env.NEWS_API_KEY) return null;

      const keywords = this.extractKeywords(claim);
      const response = await axios.get('https://newsapi.org/v2/everything', {
        params: {
          q: keywords.slice(0, 3).join(' AND '),
          apiKey: process.env.NEWS_API_KEY,
          language: 'en',
          sortBy: 'relevancy',
          pageSize: 5
        },
        timeout: this.timeout
      });

      const articles = response.data.articles
        .filter(a => this.isReputedSource(a.source.name))
        .slice(0, 3);

      if (articles.length === 0) return null;

      return {
        source: 'News Media',
        type: 'media',
        articles: articles.map(a => ({
          title: a.title,
          description: a.description,
          source: a.source.name,
          url: a.url
        })),
        text: articles.map(a => `${a.title}. ${a.description || ''}`).join(' '),
        reliability: 0.8 // Reputed news sources
      };

    } catch (error) {
      console.error('News evidence error:', error.message);
      return null;
    }
  }

  compileEvidence(evidence) {
    const compiled = {
      hasEvidence: false,
      passages: [],
      sources: []
    };

    // Prioritize: Official > News > Wikipedia
    if (evidence.government) {
      compiled.hasEvidence = true;
      compiled.passages.push(evidence.government.text);
      compiled.sources.push(evidence.government);
    }

    if (evidence.news) {
      compiled.hasEvidence = true;
      compiled.passages.push(evidence.news.text);
      compiled.sources.push(evidence.news);
    }

    if (evidence.wikipedia) {
      compiled.hasEvidence = true;
      compiled.passages.push(evidence.wikipedia.text);
      compiled.sources.push(evidence.wikipedia);
    }

    // Combine all passages for NLI
    compiled.combinedText = compiled.passages.join(' ').substring(0, 2000);

    return compiled;
  }

  extractSearchTerm(claim) {
    // Extract main entities (simplified - can be improved with NER)
    const words = claim.split(/\s+/);
    const capitalizedWords = words.filter(w => /^[A-Z]/.test(w));
    return capitalizedWords.length > 0 ? capitalizedWords.join(' ') : words.slice(0, 3).join(' ');
  }

  extractKeywords(text) {
    const stopWords = new Set(['is', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at']);
    return text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w))
      .slice(0, 5);
  }

  isReputedSource(sourceName) {
    const reputed = ['reuters', 'bbc', 'associated press', 'ap news', 'the guardian', 'the hindu'];
    return reputed.some(r => sourceName.toLowerCase().includes(r));
  }
}

module.exports = new EvidenceRetriever();