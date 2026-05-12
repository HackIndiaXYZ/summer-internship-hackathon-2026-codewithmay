const Anthropic = require('@anthropic-ai/sdk');

class AIFactChecker {
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async verifyFact(claim) {
    try {
      console.log('🤖 AI Fact Verification with Web Search started...');

      const systemPrompt = `You are an advanced fact-verification system with web search capabilities.

Your task: Verify the given claim by searching authoritative sources on the web.

PRIORITY SOURCES (in order):
1. Official government websites (pib.gov.in, mygov.in, government portals)
2. PIB Fact Check (factcheck.pib.gov.in)
3. WHO (who.int)
4. UN (un.org)
5. Wikipedia (for basic facts and context)
6. Reputed news media (Reuters, BBC, AP, The Hindu, Times of India)

VERIFICATION PROCESS:
1. Search the web for the claim
2. Check multiple authoritative sources
3. Cross-reference information
4. Determine verdict based on evidence

VERDICT CATEGORIES:
- **True**: Multiple authoritative sources confirm this as fact
- **Fake**: Officially debunked or contradicted by reliable sources
- **Misleading**: Partially true but lacks context or exaggerates
- **Unverified**: No reliable sources found to confirm or deny

CRITICAL RULES:
- For well-established facts (like "Is X the prime minister?"), search and verify
- For health claims, prioritize WHO
- For Indian government claims, prioritize PIB and government sites
- Wikipedia is acceptable for basic biographical/factual info
- If something is common knowledge AND confirmed by sources, mark as True
- Always search before deciding

OUTPUT FORMAT (JSON):
{
  "verdict": "True|Fake|Misleading|Unverified",
  "confidence": 0-100,
  "explanation": "detailed explanation of findings",
  "sources": [
    {
      "name": "source name",
      "type": "official|media|contextual",
      "verified": true|false,
      "url": "url",
      "excerpt": "relevant quote or finding"
    }
  ],
  "keyFindings": ["key point 1", "key point 2"],
  "searchPerformed": true
}

IMPORTANT: 
- Always use web search to verify claims
- Don't rely on training data alone for current facts
- Search even for seemingly obvious facts
- Provide source URLs when available`;

      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        system: systemPrompt,
        tools: [{
          type: "web_search_20250305",
          name: "web_search"
        }],
        messages: [
          {
            role: 'user',
            content: `Please verify this claim using web search. Search for authoritative sources and provide a detailed fact-check:

CLAIM: "${claim}"

Remember to:
1. Use web search to find current information
2. Check multiple sources (government, media, Wikipedia)
3. Provide specific source URLs
4. Be thorough but accurate

Respond ONLY with valid JSON, no markdown.`
          }
        ]
      });

      console.log('🤖 Raw AI Response received');

      // Extract text from all content blocks
      let responseText = '';
      for (const block of message.content) {
        if (block.type === 'text') {
          responseText += block.text;
        }
      }

      // Parse JSON response
      let jsonResponse;
      try {
        const cleanedResponse = responseText
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        
        jsonResponse = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        console.log('Response was:', responseText.substring(0, 500));
        
        // Fallback response
        jsonResponse = {
          verdict: 'Unverified',
          confidence: 50,
          explanation: 'AI analysis completed but had difficulty parsing results. The claim could not be definitively verified.',
          sources: [],
          keyFindings: ['Analysis completed with parsing issues'],
          searchPerformed: false,
          error: true
        };
      }

      console.log('✅ AI Fact Check Complete:', jsonResponse.verdict, `(${jsonResponse.confidence}% confidence)`);
      return jsonResponse;

    } catch (error) {
      console.error('❌ AI Fact Checker Error:', error.message);
      
      // Return fallback response
      return {
        verdict: 'Unverified',
        confidence: 0,
        explanation: 'AI verification service temporarily unavailable. Manual fact-checking recommended.',
        sources: [],
        keyFindings: ['AI service error: ' + error.message],
        searchPerformed: false,
        error: true
      };
    }
  }

  // Map AI verdict to risk score
  verdictToRiskScore(verdict, confidence) {
    const baseScores = {
      'True': 10,          // Very low risk
      'Unverified': 60,    // Medium-high risk
      'Misleading': 75,    // High risk
      'Fake': 95           // Very high risk
    };

    const baseScore = baseScores[verdict] || 60;
    
    // Adjust based on confidence
    // High confidence in "True" = very low risk
    // Low confidence in "True" = slightly higher risk
    let confidenceAdjustment = 0;
    
    if (verdict === 'True') {
      // High confidence in truth reduces risk more
      confidenceAdjustment = (confidence - 50) * -0.15;
    } else if (verdict === 'Fake') {
      // High confidence in fake increases risk
      confidenceAdjustment = (confidence - 50) * 0.15;
    }

    const finalScore = Math.round(Math.min(Math.max(baseScore + confidenceAdjustment, 0), 100));
    console.log(`📊 Risk Calculation: ${verdict} (${confidence}%) → Base: ${baseScore}, Adjustment: ${confidenceAdjustment.toFixed(1)}, Final: ${finalScore}`);
    
    return finalScore;
  }
}

module.exports = new AIFactChecker();