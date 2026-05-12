const axios = require('axios');

class GoogleFactCheckService {
  constructor() {
    this.apiKey = process.env.GOOGLE_FACT_CHECK_API_KEY;
    this.baseUrl = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';
  }

  async search(claim) {
    if (!this.apiKey) {
      console.log('      ⚠️  Google Fact Check API key not configured');
      return [];
    }

    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          query: claim,
          key: this.apiKey,
          languageCode: 'en',
          pageSize: 20  // Reduced from 20 to 10 for faster response
        },
        timeout: 15000  // Reduced timeout
      });

      if (!response.data.claims || response.data.claims.length === 0) {
        console.log('      ⚠️  No Google Fact Check results found');
        return [];
      }

      const factChecks = [];

      // Process up to 3 sources (reduced from 5)
      for (const claimData of response.data.claims.slice(0, 3)) {
        if (factChecks.length >= 3) break;

        if (claimData.claimReview && claimData.claimReview.length > 0) {
          const review = claimData.claimReview[0];
          
          const verdict = this.mapRatingToVerdict(review.textualRating);
          const confidence = this.calculateConfidence(review.textualRating);

          factChecks.push({
            name: `${review.publisher.name} Fact Check`,
            type: 'fact-check',
            verdict: verdict,
            confidence: confidence,
            url: review.url,
            hasEvidence: true,
            excerpt: `"${review.textualRating}" - ${claimData.text.substring(0, 150)}...`,
            fullText: `Fact-Check by ${review.publisher.name}:\n\nClaim: ${claimData.text}\n\nRating: ${review.textualRating}\n\nReview Title: ${review.title || 'N/A'}\n\nPublished: ${review.reviewDate || 'Unknown date'}\n\nConclusion: ${review.textualRating}`,
            metadata: {
              publisher: review.publisher.name,
              rating: review.textualRating,
              date: review.reviewDate,
              title: review.title
            }
          });
        }
      }

      console.log(`      ✅ Found ${factChecks.length} Google Fact Check source(s)`);
      return factChecks;
    } catch (error) {
      console.error('      ❌ Google Fact Check API error:', error.message);
      return [];
    }
  }

  mapRatingToVerdict(rating) {
    if (!rating) return 'UNCERTAIN';

    const ratingLower = rating.toLowerCase();
    
    const trueIndicators = ['true', 'correct', 'accurate', 'verified', 'confirmed', 'factual', 'mostly true'];
    const falseIndicators = ['false', 'incorrect', 'fake', 'debunked', 'misleading', 'unproven', 'pants on fire', 'mostly false'];
    
    const isTrue = trueIndicators.some(indicator => ratingLower.includes(indicator));
    const isFalse = falseIndicators.some(indicator => ratingLower.includes(indicator));

    if (isTrue && !isFalse) return 'TRUE';
    if (isFalse && !isTrue) return 'FALSE';
    return 'UNCERTAIN';
  }

  calculateConfidence(rating) {
    if (!rating) return 50;

    const ratingLower = rating.toLowerCase();
    
    // High confidence ratings
    if (ratingLower.includes('true') || ratingLower.includes('false')) {
      if (ratingLower.includes('mostly') || ratingLower.includes('partly')) {
        return 75;
      }
      return 90;
    }
    
    // Medium confidence
    if (ratingLower.includes('misleading') || ratingLower.includes('unproven')) {
      return 70;
    }
    
    // Low confidence
    return 60;
  }
}

module.exports = new GoogleFactCheckService();