const axios = require('axios');
const cheerio = require('cheerio');

// Source authority mapping for different claim types
const SOURCE_AUTHORITY = {
  'political-domestic': ['PIB Fact Check', 'Gov Portals', 'Wikipedia', 'News Media'],
  'health': ['WHO', 'Wikipedia', 'News Media'],
  'conflict': ['UN', 'News Media', 'Wikipedia'],
  'science': ['Wikipedia', 'News Media'],
  'general': ['Wikipedia', 'News Media', 'PIB Fact Check']
};

class DirectSourceChecker {
  constructor() {
    this.timeout = 15000; // 15 seconds for deep searches
  }

  // ============ CLAIM TYPE CLASSIFIER ============
  getClaimType(claim) {
    const c = claim.toLowerCase();

    if (c.match(/prime minister|president|pm|chief minister|cm|minister|government|ruling|opposition/))
      return 'political-domestic';

    if (c.match(/virus|covid|health|disease|vaccine|medical|doctor|hospital/))
      return 'health';

    if (c.match(/war|attack|killed|dead|missile|terror|conflict|military/))
      return 'conflict';

    if (c.match(/climate|temperature|earth|space|nasa|science|research/))
      return 'science';

    return 'general';
  }

  // ============ DEEP WIKIPEDIA SEARCH ============
  async checkWikipedia(claim) {
    try {
      console.log('📚 Deep Wikipedia search...');
      const keywords = this.extractKeywords(claim);
      const searchTerm = keywords.slice(0, 4).join(' ');
      
      // Wikipedia API search
      const searchUrl = 'https://en.wikipedia.org/w/api.php';
      const searchResponse = await axios.get(searchUrl, {
        params: {
          action: 'query',
          list: 'search',
          srsearch: searchTerm,
          format: 'json',
          origin: '*',
          srlimit: 5
        },
        timeout: this.timeout,
        headers: {
          'User-Agent': 'FakeNewsDetector/1.0 Educational',
          'Accept': 'application/json'
        }
      });

      if (!searchResponse.data.query || searchResponse.data.query.search.length === 0) {
        console.log('   ❌ No Wikipedia articles found');
        return { 
          source: 'Wikipedia', 
          type: 'contextual', 
          found: false, 
          checked: true,
          confidence: 0
        };
      }

      // Get the top article's full content
      const topResult = searchResponse.data.query.search[0];
      const pageTitle = topResult.title;
      
      console.log(`   📄 Analyzing: "${pageTitle}"`);

      // Get full page content
      const contentResponse = await axios.get(searchUrl, {
        params: {
          action: 'query',
          titles: pageTitle,
          prop: 'extracts|info',
          inprop: 'url',
          exintro: false,
          explaintext: true,
          format: 'json',
          origin: '*'
        },
        timeout: this.timeout,
        headers: {
          'User-Agent': 'FakeNewsDetector/1.0 Educational'
        }
      });

      const pages = contentResponse.data.query.pages;
      const pageId = Object.keys(pages)[0];
      const pageData = pages[pageId];
      
      if (!pageData || !pageData.extract) {
        return { 
          source: 'Wikipedia', 
          type: 'contextual', 
          found: false, 
          checked: true,
          confidence: 0
        };
      }

      const fullText = pageData.extract.toLowerCase();
      const claimLower = claim.toLowerCase();

      // DEEP SEMANTIC ANALYSIS
      const analysis = this.deepSemanticAnalysis(claimLower, fullText, pageTitle);
      
      console.log(`   🔍 Confidence: ${analysis.confidence}%, Match: ${analysis.verified ? '✅' : '❌'}`);

      return {
        source: 'Wikipedia',
        type: 'contextual',
        checked: true,
        found: analysis.verified,
        confidence: analysis.confidence,
        title: pageTitle,
        url: pageData.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`,
        excerpt: pageData.extract.substring(0, 300),
        matchDetails: analysis.details
      };

    } catch (error) {
      console.log('⚠️ Wikipedia check failed:', error.message);
      return { 
        source: 'Wikipedia', 
        type: 'contextual', 
        checked: false, 
        error: error.message,
        confidence: 0
      };
    }
  }

  // ============ DEEP SEMANTIC ANALYSIS ============
  deepSemanticAnalysis(claim, sourceText, sourceTitle) {
    const details = {
      keywordMatch: 0,
      contextMatch: 0,
      entityMatch: 0,
      contradictions: []
    };

    // Extract entities from claim
    const claimEntities = this.extractEntities(claim);
    const sourceEntities = this.extractEntities(sourceText);

    // 1. KEYWORD MATCHING (30%)
    const claimKeywords = this.extractKeywords(claim);
    const matchedKeywords = claimKeywords.filter(kw => sourceText.includes(kw));
    details.keywordMatch = claimKeywords.length > 0 ? (matchedKeywords.length / claimKeywords.length) * 30 : 0;

    // 2. ENTITY MATCHING (40%)
    let entityMatches = 0;
    claimEntities.forEach(entity => {
      if (sourceText.includes(entity.value) || sourceTitle.toLowerCase().includes(entity.value)) {
        entityMatches++;
        
        // Verify the context around the entity
        const entityContext = this.extractContext(sourceText, entity.value);
        
        // Check for contradictions
        if (entity.type === 'position' && !entityContext.includes(entity.value)) {
          details.contradictions.push(`Position "${entity.value}" not confirmed in context`);
        }
      } else {
        details.contradictions.push(`Entity "${entity.value}" not found in source`);
      }
    });
    details.entityMatch = claimEntities.length > 0 ? (entityMatches / claimEntities.length) * 40 : 0;

    // 3. CONTEXTUAL MATCHING (30%)
    // Check if the claim's main assertion is in the source
    const claimAssertion = this.extractMainAssertion(claim);
    const assertionInSource = this.checkAssertionInSource(claimAssertion, sourceText);
    details.contextMatch = assertionInSource ? 30 : 0;

    // Calculate total confidence
    let confidence = details.keywordMatch + details.entityMatch + details.contextMatch;

    // Penalty for contradictions
    if (details.contradictions.length > 0) {
      const penalty = Math.min(details.contradictions.length * 15, 40);
      confidence = Math.max(0, confidence - penalty);
    }

    return {
      confidence: Math.round(confidence),
      verified: confidence >= 65 && details.contradictions.length === 0,
      details: details
    };
  }

  // ============ ENTITY EXTRACTION ============
  extractEntities(text) {
    const entities = [];

    // Extract names (capitalized words)
    const namePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
    const names = text.match(namePattern) || [];
    names.forEach(name => {
      if (name.length > 3 && !this.isStopWord(name.toLowerCase())) {
        entities.push({ type: 'name', value: name.toLowerCase() });
      }
    });

    // Extract positions
    const positions = ['prime minister', 'president', 'chief minister', 'minister', 'pm', 'cm'];
    positions.forEach(pos => {
      if (text.includes(pos)) {
        entities.push({ type: 'position', value: pos });
      }
    });

    // Extract countries
    const countries = ['india', 'usa', 'uk', 'china', 'russia', 'france', 'germany', 'japan'];
    countries.forEach(country => {
      if (text.includes(country)) {
        entities.push({ type: 'country', value: country });
      }
    });

    return entities;
  }

  // ============ EXTRACT CONTEXT ============
  extractContext(text, entity, windowSize = 100) {
    const index = text.indexOf(entity);
    if (index === -1) return '';
    
    const start = Math.max(0, index - windowSize);
    const end = Math.min(text.length, index + entity.length + windowSize);
    
    return text.substring(start, end);
  }

  // ============ EXTRACT MAIN ASSERTION ============
  extractMainAssertion(claim) {
    // Extract the main verb and subject
    const claimLower = claim.toLowerCase();
    
    if (claimLower.includes('is')) {
      const parts = claimLower.split('is');
      return parts.join(' is ').trim();
    }
    
    if (claimLower.includes('are')) {
      const parts = claimLower.split('are');
      return parts.join(' are ').trim();
    }
    
    return claim.toLowerCase();
  }

  // ============ CHECK ASSERTION IN SOURCE ============
  checkAssertionInSource(assertion, source) {
    const assertionWords = assertion.split(/\s+/).filter(w => w.length > 3);
    const matchCount = assertionWords.filter(word => source.includes(word)).length;
    
    return assertionWords.length > 0 && (matchCount / assertionWords.length) >= 0.7;
  }

  // ============ DEEP PIB FACT CHECK ============
  async checkPIBFactCheck(claim) {
    try {
      console.log('🇮🇳 Deep PIB Fact Check search...');
      
      // Search PIB website using Google Custom Search simulation
      const keywords = this.extractKeywords(claim);
      const searchQuery = `site:factcheck.pib.gov.in ${keywords.join(' ')}`;
      
      // Use DuckDuckGo as a fallback search
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
      
      const response = await axios.get(searchUrl, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      const results = [];

      $('.result__a, .result__url').each((i, elem) => {
        if (i < 5) {
          const title = $(elem).text().trim();
          const url = $(elem).attr('href');
          
          if (title && url && url.includes('factcheck.pib.gov.in')) {
            const similarity = this.advancedSimilarity(claim, title);
            results.push({ title, url, similarity });
          }
        }
      });

      results.sort((a, b) => b.similarity - a.similarity);
      const best = results[0];
      
      const confidence = best ? Math.round(best.similarity * 100) : 0;
      const verified = confidence >= 60;

      console.log(`   ${verified ? '✅' : '❌'} PIB: ${confidence}% confidence`);

      return {
        source: 'PIB Fact Check',
        type: 'official',
        checked: true,
        found: verified,
        confidence: confidence,
        url: best?.url || 'https://factcheck.pib.gov.in',
        evidence: best
      };

    } catch (error) {
      console.log('⚠️ PIB check failed:', error.message);
      return { 
        source: 'PIB Fact Check', 
        type: 'official', 
        checked: false, 
        error: error.message,
        confidence: 0
      };
    }
  }

  // ============ DEEP NEWS API CHECK ============
  async checkNewsAPIs(claim) {
    try {
      console.log('📰 Deep news search...');
      
      if (!process.env.NEWS_API_KEY) {
        return { 
          source: 'News Media', 
          type: 'media', 
          checked: false, 
          skipped: true,
          confidence: 0
        };
      }

      const keywords = this.extractKeywords(claim);
      const response = await axios.get('https://newsapi.org/v2/everything', {
        params: {
          q: keywords.slice(0, 4).join(' AND '),
          apiKey: process.env.NEWS_API_KEY,
          language: 'en',
          sortBy: 'relevancy',
          pageSize: 10
        },
        timeout: this.timeout
      });

      const articles = response.data.articles.map(a => ({
        title: a.title,
        source: a.source.name,
        url: a.url,
        description: a.description,
        similarity: this.advancedSimilarity(claim, a.title + ' ' + (a.description || ''))
      }));

      articles.sort((a, b) => b.similarity - a.similarity);
      
      const topArticle = articles[0];
      const avgSimilarity = articles.slice(0, 3).reduce((sum, a) => sum + a.similarity, 0) / Math.min(3, articles.length);
      const confidence = Math.round(avgSimilarity * 100);
      const verified = confidence >= 50 && articles.length >= 2;

      console.log(`   ${verified ? '✅' : '❌'} News: ${confidence}% confidence (${articles.length} articles)`);

      return {
        source: 'News Media',
        type: 'media',
        checked: true,
        found: verified,
        confidence: confidence,
        articles: articles.slice(0, 3),
        totalFound: response.data.totalResults
      };

    } catch (error) {
      console.log('⚠️ News API check failed:', error.message);
      return { 
        source: 'News Media', 
        type: 'media', 
        checked: false, 
        error: error.message,
        confidence: 0
      };
    }
  }

  // ============ GOVERNMENT PORTALS DEEP SEARCH ============
  async checkGovernmentPortals(claim) {
    try {
      console.log('🏛️ Deep government portal search...');
      
      const keywords = this.extractKeywords(claim);
      const searchQuery = `site:gov.in ${keywords.join(' ')}`;
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;

      const response = await axios.get(searchUrl, {
        timeout: this.timeout,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      const $ = cheerio.load(response.data);
      const results = [];

      $('.result__a').each((i, elem) => {
        if (i < 5) {
          const title = $(elem).text();
          const url = $(elem).attr('href');
          const similarity = this.advancedSimilarity(claim, title);
          results.push({ title, url, similarity });
        }
      });

      results.sort((a, b) => b.similarity - a.similarity);
      const best = results[0];
      const confidence = best ? Math.round(best.similarity * 100) : 0;
      const verified = confidence >= 65;

      console.log(`   ${verified ? '✅' : '❌'} Gov: ${confidence}% confidence`);

      return {
        source: 'Gov Portals',
        type: 'official',
        checked: true,
        found: verified,
        confidence: confidence,
        evidence: best
      };

    } catch (error) {
      return { 
        source: 'Gov Portals', 
        type: 'official', 
        checked: false, 
        error: error.message,
        confidence: 0
      };
    }
  }

  // ============ WHO, UN (Simplified for non-health/conflict claims) ============
  async checkWHO(claim) {
    const claimType = this.getClaimType(claim);
    if (claimType !== 'health') {
      return { source: 'WHO', type: 'official', checked: true, found: false, skipped: true, confidence: 0 };
    }
    
    // Similar deep search logic...
    return { source: 'WHO', type: 'official', checked: true, found: false, confidence: 0 };
  }

  async checkUN(claim) {
    const claimType = this.getClaimType(claim);
    if (!['conflict', 'science'].includes(claimType)) {
      return { source: 'UN', type: 'official', checked: true, found: false, skipped: true, confidence: 0 };
    }
    
    return { source: 'UN', type: 'official', checked: true, found: false, confidence: 0 };
  }

  // ============ ADVANCED SIMILARITY ============
  advancedSimilarity(text1, text2) {
    if (!text2) return 0;
    
    const words1 = this.extractKeywords(text1.toLowerCase());
    const words2 = this.extractKeywords(text2.toLowerCase());
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    // Jaccard + TF-IDF inspired
    const intersection = words1.filter(w => words2.includes(w));
    const union = [...new Set([...words1, ...words2])];
    
    const jaccard = intersection.length / union.length;
    
    // Boost for entity matches
    const entities1 = this.extractEntities(text1);
    const entities2 = this.extractEntities(text2);
    const entityMatches = entities1.filter(e1 => 
      entities2.some(e2 => e2.value === e1.value)
    ).length;
    
    const entityBoost = entityMatches > 0 ? 0.2 : 0;
    
    return Math.min(1, jaccard + entityBoost);
  }

  // ============ HELPERS ============
  extractKeywords(text) {
    const stops = new Set(['is', 'the', 'of', 'and', 'are', 'was', 'were', 'for', 'in', 'on', 'with', 'who', 'what', 'a', 'an']);
    return text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stops.has(w));
  }

  isStopWord(word) {
    const stops = ['the', 'is', 'are', 'was', 'were', 'this', 'that', 'with'];
    return stops.includes(word);
  }

  // ============ MAIN VERIFICATION ============
  async verifyFromAllSources(claim) {
    console.log('🌐 Starting DEEP multi-source verification...');

    const [pib, wiki, news, gov] = await Promise.allSettled([
      this.checkPIBFactCheck(claim),
      this.checkWikipedia(claim),
      this.checkNewsAPIs(claim),
      this.checkGovernmentPortals(claim)
    ]);

    const verified = {
      pib: pib.status === 'fulfilled' ? pib.value : { checked: false, confidence: 0 },
      wikipedia: wiki.status === 'fulfilled' ? wiki.value : { checked: false, confidence: 0 },
      news: news.status === 'fulfilled' ? news.value : { checked: false, confidence: 0 },
      government: gov.status === 'fulfilled' ? gov.value : { checked: false, confidence: 0 }
    };

    return this.aggregateResults(verified, claim);
  }

  // ============ PRECISE AGGREGATION ============
  aggregateResults(verified, claim) {
    const claimType = this.getClaimType(claim);
    const allowedSources = SOURCE_AUTHORITY[claimType] || [];

    const allSources = [];
    const confidenceScores = [];

    Object.values(verified).forEach(s => {
      if (!s || !s.checked) return;

      const isAuthoritative = allowedSources.some(auth => s.source.includes(auth));
      
      allSources.push({
        name: s.source,
        verified: s.found && isAuthoritative,
        checked: true,
        confidence: s.confidence || 0,
        authoritative: isAuthoritative,
        url: s.url
      });

      if (s.found && isAuthoritative && s.confidence) {
        confidenceScores.push(s.confidence);
      }
    });

    // Calculate weighted average confidence
    const overallConfidence = confidenceScores.length > 0
      ? Math.round(confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length)
      : 0;

    const authoritativeConfirmation = confidenceScores.length >= 2 && overallConfidence >= 65;

    console.log(`📊 Overall Confidence: ${overallConfidence}%`);
    console.log(`✅ Authoritative Confirmation: ${authoritativeConfirmation ? 'YES' : 'NO'}`);

    return {
      claimType,
      authoritativeConfirmation,
      sources: allSources,
      totalChecked: allSources.length,
      overallConfidence,
      verifiedSourceCount: allSources.filter(s => s.verified).length
    };
  }
}

module.exports = new DirectSourceChecker();