// backend/services/sourceAggregator.js
const googleFactCheck = require('./googleFactCheck');
const wikipediaDeep = require('./wikipediaDeep');
const newsAPI = require('./newsAPI');
const gdeltAPI = require('./gdeltAPI');
const axios = require('axios');

class SourceAggregator {
  constructor() {
    this.pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
  }

  async gatherAllEvidence(claim) {
    const startTime = Date.now();
    console.log('📡 Starting multi-source evidence gathering...\n');

    // Add timeout wrapper for each source
    const withTimeout = (promise, timeoutMs, sourceName) => {
      return Promise.race([
        promise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`${sourceName} timeout`)), timeoutMs)
        )
      ]);
    };

    // Run all sources in parallel with individual timeouts
    const results = await Promise.allSettled([
      withTimeout(this.fetchGoogleFactCheck(claim), 15000, 'Google Fact Check'),
      withTimeout(this.fetchWikipedia(claim), 20000, 'Wikipedia'),
      withTimeout(this.fetchNews(claim), 15000, 'News'),
      withTimeout(this.fetchGDELT(claim), 15000, 'GDELT'),
      withTimeout(this.fetchPythonMLModels(claim), 30000, 'ML Models')
    ]);

    const sources = [];
    let sourcesChecked = 0;

    // Process Google Fact Check (returns array)
    if (results[0].status === 'fulfilled' && results[0].value && results[0].value.length > 0) {
      sources.push(...results[0].value);
      sourcesChecked++;
    }

    // Process Wikipedia (returns array)
    if (results[1].status === 'fulfilled' && results[1].value && results[1].value.length > 0) {
      sources.push(...results[1].value);
      sourcesChecked++;
    }

    // Process News (returns array)
    if (results[2].status === 'fulfilled' && results[2].value && results[2].value.length > 0) {
      sources.push(...results[2].value);
      sourcesChecked++;
    }

    // Process GDELT (returns array)
    if (results[3].status === 'fulfilled' && results[3].value && results[3].value.length > 0) {
      sources.push(...results[3].value);
      sourcesChecked++;
    }

    // Process Python ML Models (returns array)
    if (results[4].status === 'fulfilled' && results[4].value && results[4].value.length > 0) {
      sources.push(...results[4].value);
      sourcesChecked++;
    }

    const processingTime = Date.now() - startTime;
    
    console.log(`\n✅ Evidence gathering complete: ${sources.length} sources in ${(processingTime / 1000).toFixed(2)}s\n`);

    return {
      claim,
      sources,
      sourcesChecked,
      totalSources: sources.length,
      processingTime
    };
  }

  async fetchGoogleFactCheck(claim) {
    try {
      console.log('🔍 [1/5] Fetching Google Fact Check...');
      const result = await googleFactCheck.search(claim);
      
      if (!result || result.length === 0) {
        console.log('   ⚠️  No fact-checks found');
        return [];
      }

      console.log(`   ✅ Found ${result.length} fact-check(s)`);
      return result;
    } catch (error) {
      console.error('   ❌ Google Fact Check error:', error.message);
      return [];
    }
  }

  async fetchWikipedia(claim) {
    try {
      console.log('📚 [2/5] Deep fetching Wikipedia...');
      const results = await wikipediaDeep.deepFetch(claim);
      
      if (!results || results.length === 0) {
        console.log('   ⚠️  No Wikipedia articles found');
        return [];
      }

      console.log(`   ✅ Found ${results.length} Wikipedia article(s)`);
      return results;
    } catch (error) {
      console.error('   ❌ Wikipedia error:', error.message);
      return [];
    }
  }

  async fetchNews(claim) {
    try {
      console.log('📰 [3/5] Fetching news articles...');
      const articles = await newsAPI.searchArticles(claim);
      
      if (!articles || articles.length === 0) {
        console.log('   ⚠️  No news articles found');
        return [];
      }

      console.log(`   ✅ Found ${articles.length} article(s)`);
      return articles;
    } catch (error) {
      console.error('   ❌ News API error:', error.message);
      return [];
    }
  }

  async fetchGDELT(claim) {
    try {
      console.log('🌍 [4/5] Fetching GDELT data...');
      const events = await gdeltAPI.searchEvents(claim);
      
      if (!events || events.length === 0) {
        console.log('   ⚠️  No GDELT events found');
        return [];
      }

      console.log(`   ✅ Found ${events.length} event(s)`);
      return events;
    } catch (error) {
      console.error('   ❌ GDELT error:', error.message);
      return [];
    }
  }

  async fetchPythonMLModels(claim) {
    try {
      console.log('🤖 [5/5] Running ML models (Python service)...');
      
      const response = await axios.post(`${this.pythonServiceUrl}/analyze`, {
        claim: claim
      }, {
        timeout: 30000, // Reduced from 60s to 30s
        headers: { 'Content-Type': 'application/json' }
      });

      const models = response.data.models || [];
      
      if (models.length === 0) {
        console.log('   ⚠️  No ML model results');
        return [];
      }

      console.log(`   ✅ Completed ${models.length} ML model(s)`);
      return models;
    } catch (error) {
      console.error('   ❌ Python ML service error:', error.message);
      return [];
    }
  }
}

module.exports = new SourceAggregator();