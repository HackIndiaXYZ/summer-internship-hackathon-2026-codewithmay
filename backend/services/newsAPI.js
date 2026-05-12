// backend/services/newsapi.js
// Real-time news source integration for fact-checking
const axios = require('axios');

class NewsAPIService {
  constructor() {
    this.apiKey = process.env.NEWS_API_KEY;
    this.baseUrl = 'https://serpapi.com/search?engine=google_news';
    this.enabled = !!this.apiKey;
    
    if (!this.enabled) {
      console.warn('⚠️  NEWS API: No API key found. Set NEWS_API_KEY in .env');
    }
  }

  async searchNews(query, options = {}) {
    if (!this.enabled) {
      console.log('   📰 NEWS API: Skipped (no API key)');
      return null;
    }

    try {
      console.log(`   📰 Searching NewsAPI for: "${query}"`);
      
      const params = {
        q: query,
        language: options.language || 'en',
        sortBy: options.sortBy || 'relevancy',
        pageSize: options.limit || 5,
        apiKey: this.apiKey
      };

      // Add date filtering if specified
      if (options.from) params.from = options.from;
      if (options.to) params.to = options.to;

      const response = await axios.get(`${this.baseUrl}/everything`, {
        params,
        timeout: 10000
      });

      if (response.data.status !== 'ok') {
        throw new Error(`NewsAPI error: ${response.data.message || 'Unknown error'}`);
      }

      const articles = response.data.articles || [];
      console.log(`   ✅ Found ${articles.length} news articles`);

      return this.formatArticles(articles);
    } catch (error) {
      if (error.response?.status === 426) {
        console.error('   ❌ NEWS API: Upgrade required (free tier limits exceeded)');
      } else if (error.response?.status === 401) {
        console.error('   ❌ NEWS API: Invalid API key');
      } else {
        console.error('   ❌ NEWS API error:', error.message);
      }
      return null;
    }
  }

  async getTopHeadlines(query, options = {}) {
    if (!this.enabled) {
      console.log('   📰 NEWS API: Skipped (no API key)');
      return null;
    }

    try {
      console.log(`   📰 Fetching top headlines for: "${query}"`);
      
      const params = {
        q: query,
        language: options.language || 'en',
        pageSize: options.limit || 5,
        apiKey: this.apiKey
      };

      if (options.country) params.country = options.country;
      if (options.category) params.category = options.category;

      const response = await axios.get(`${this.baseUrl}/top-headlines`, {
        params,
        timeout: 10000
      });

      if (response.data.status !== 'ok') {
        throw new Error(`NewsAPI error: ${response.data.message || 'Unknown error'}`);
      }

      const articles = response.data.articles || [];
      console.log(`   ✅ Found ${articles.length} top headlines`);

      return this.formatArticles(articles);
    } catch (error) {
      console.error('   ❌ NEWS API error:', error.message);
      return null;
    }
  }

  formatArticles(articles) {
    return articles
      .filter(article => article.title && article.description)
      .map(article => ({
        name: article.source.name || 'News Source',
        type: 'News Article',
        url: article.url,
        title: article.title,
        description: article.description,
        fullText: this.extractFullText(article),
        publishedAt: article.publishedAt,
        author: article.author,
        credibility: this.assessCredibility(article.source.name)
      }));
  }

  extractFullText(article) {
    let text = '';
    
    if (article.title) {
      text += `${article.title}\n\n`;
    }
    
    if (article.description) {
      text += `${article.description}\n\n`;
    }
    
    if (article.content) {
      // NewsAPI content is often truncated with [+XXX chars]
      const cleanContent = article.content.replace(/\[\+\d+ chars\]$/, '');
      text += cleanContent;
    }
    
    if (article.publishedAt) {
      const date = new Date(article.publishedAt);
      text += `\n\nPublished: ${date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}`;
    }
    
    return text.trim();
  }

  assessCredibility(sourceName) {
    // Rate news sources based on known reliability
    const highCredibility = [
      'Reuters', 'Associated Press', 'AP News', 'BBC News', 'NPR',
      'The New York Times', 'The Washington Post', 'The Guardian',
      'Bloomberg', 'Financial Times', 'The Wall Street Journal',
      'CNN', 'ABC News', 'CBS News', 'NBC News', 'PBS'
    ];

    const mediumCredibility = [
      'USA Today', 'Time', 'Newsweek', 'Forbes', 'Business Insider',
      'Politico', 'The Hill', 'Fox News', 'MSNBC', 'Axios'
    ];

    const source = sourceName.toLowerCase();
    
    for (const trusted of highCredibility) {
      if (source.includes(trusted.toLowerCase())) {
        return 'high';
      }
    }
    
    for (const medium of mediumCredibility) {
      if (source.includes(medium.toLowerCase())) {
        return 'medium';
      }
    }
    
    return 'unknown';
  }

  // Helper to get date range for recent news
  getRecentDateRange(days = 30) {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    
    return {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0]
    };
  }

  // Main method for fact-checking integration - UPDATED TO MATCH sourceAggregator
  async searchArticles(claim, options = {}) {
    if (!this.enabled) {
      console.log('      ⚠️  NewsAPI disabled - no API key configured');
      return [];
    }

    try {
      // Get recent news (last 30 days by default)
      const dateRange = this.getRecentDateRange(options.days || 30);
      
      const newsResults = await this.searchNews(claim, {
        limit: options.limit || 5,
        from: dateRange.from,
        to: dateRange.to,
        sortBy: 'relevancy'
      });

      if (!newsResults || newsResults.length === 0) {
        console.log('      ℹ️  No recent news articles found');
        return [];
      }

      // Format results to match your source structure
      return newsResults.map(article => ({
        name: article.name,
        type: article.type,
        verdict: 'REPORTED', // News articles report information
        confidence: this.calculateNewsRelevance(claim, article),
        url: article.url,
        hasEvidence: true,
        excerpt: article.description || article.title,
        fullText: article.fullText,
        metadata: {
          publishedAt: article.publishedAt,
          author: article.author,
          credibility: article.credibility
        }
      }));
    } catch (error) {
      console.error('      ❌ Error fetching news:', error.message);
      return [];
    }
  }

  // Calculate relevance of news article to claim
  calculateNewsRelevance(claim, article) {
    const claimKeywords = this.extractKeywords(claim);
    const articleText = `${article.title} ${article.description} ${article.fullText}`.toLowerCase();
    
    const matchedKeywords = claimKeywords.filter(keyword => 
      articleText.includes(keyword.toLowerCase())
    );
    
    const relevanceScore = claimKeywords.length > 0 
      ? (matchedKeywords.length / claimKeywords.length) * 100 
      : 50;
    
    // Boost for high credibility sources
    let credibilityBoost = 0;
    if (article.credibility === 'high') credibilityBoost = 10;
    else if (article.credibility === 'medium') credibilityBoost = 5;
    
    return Math.min(100, Math.round(relevanceScore + credibilityBoost));
  }

  // Keep the old method name for backward compatibility
  async fetchNewsEvidence(claim, options = {}) {
    return this.searchArticles(claim, options);
  }

  extractKeywords(text) {
    // Simple keyword extraction - remove common words
    const stopWords = new Set([
      'is', 'are', 'was', 'were', 'the', 'a', 'an', 'and', 'or', 'but',
      'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as',
      'that', 'this', 'it', 'be', 'have', 'has', 'had', 'do', 'does', 'did'
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word))
      .slice(0, 5); // Top 5 keywords
  }
}

module.exports = new NewsAPIService();