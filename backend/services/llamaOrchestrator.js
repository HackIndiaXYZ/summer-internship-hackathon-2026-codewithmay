// backend/services/llamaOrchestrator.js
// BALANCED: Fast + Accurate with smart evidence extraction
// Updated to use gpt:oss120b-cloud instead of llama3.1
const axios = require('axios');

class LlamaOrchestrator {
  constructor() {
    this.ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.model = 'gpt-oss:120b-cloud'; // Cloud model accessed via Ollama
  }

  async analyzeWithLlama(claim, evidence) {
    try {
      console.log('🤖 Starting GPT OSS 120B Cloud analysis...\n');

      // Build smart prompt with relevant evidence extraction
      const prompt = this.buildSmartPrompt(claim, evidence);

      console.log(`   📝 Analyzing ${evidence.sources.length} sources...`);
      console.log(`   📄 Prompt length: ${prompt.length} characters`);

      const analysis = await this.callLlama(prompt);

      console.log(`   ✅ Analysis complete!`);
      console.log(`   🎯 Final Verdict: ${analysis.verdict} (${analysis.confidence}%)`);

      return analysis;
    } catch (error) {
      console.error('   ❌ GPT analysis error:', error.message);
      return this.fallbackAnalysis(claim, evidence);
    }
  }

  // SMART EXTRACTION: Focus on verdict-relevant content
  extractRelevantContent(fullText, claim, maxChars = 1000) {
    if (!fullText || fullText.length <= maxChars) {
      return fullText || '';
    }

    const claimKeywords = claim.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3) // Skip short words
      .slice(0, 5); // Top 5 keywords

    // Find paragraphs/sentences containing claim keywords
    const sentences = fullText.match(/[^.!?]+[.!?]+/g) || [fullText];
    const scoredSentences = sentences.map(sentence => {
      const lowerSentence = sentence.toLowerCase();
      const score = claimKeywords.filter(kw => lowerSentence.includes(kw)).length;
      return { sentence, score };
    });

    // Sort by relevance and take top sentences
    scoredSentences.sort((a, b) => b.score - a.score);
    
    let extracted = '';
    for (const item of scoredSentences) {
      if (extracted.length + item.sentence.length > maxChars) break;
      if (item.score > 0) { // Only include relevant sentences
        extracted += item.sentence + ' ';
      }
    }

    // If no relevant sentences found, take beginning (verdict often early)
    if (extracted.length < 200) {
      extracted = fullText.substring(0, maxChars);
    }

    return extracted.trim();
  }

  buildSmartPrompt(claim, evidence) {
    let prompt = `You are a professional fact-checker analyzing claims based on authoritative evidence sources.

CLAIM: "${claim}"

EVIDENCE FROM ${evidence.sources.length} SOURCES:
`;

    // Extract relevant portions from each source
    evidence.sources.forEach((source, idx) => {
      prompt += `\n${idx + 1}. ${source.name} (${source.type}):`;
      
      if (source.fullText) {
        // SMART EXTRACTION: Get claim-relevant content
        const relevantText = this.extractRelevantContent(
          source.fullText, 
          claim, 
          1200 // Slightly larger for better context
        );
        prompt += ` ${relevantText}`;
        
        if (source.fullText.length > relevantText.length) {
          prompt += '...';
        }
      }
      prompt += `\n`;
    });

    prompt += `

ANALYSIS INSTRUCTIONS:
1. Carefully evaluate the provided evidence sources
   - Prioritize recent, authoritative sources
   - Check publication dates - newer sources may reflect recent changes
   - Look for consensus among current, credible sources
   - Consider source reliability and credibility

2. Determine the verdict based on evidence quality:
   - If recent authoritative sources strongly support the claim → likely TRUE
   - If credible sources clearly contradict the claim → likely FALSE
   - If sources conflict or lack sufficient information → UNCERTAIN
   - For current events (politics, elections, positions) → prioritize most recent evidence

3. EXPLAIN YOUR REASONING thoroughly (800-1000 characters):
   - Analyze what the current evidence shows
   - Discuss evidence recency and source credibility
   - Address how recent events may have changed the situation
   - Justify your confidence level with specific reasoning
   - Note any important temporal context (e.g., "as of 2025")
   - DO NOT mention "training data", "baseline knowledge", or "what I know independently"
   - Focus ONLY on the evidence provided and your factual analysis

4. PROVIDE A COMPREHENSIVE SUMMARY (200-300 characters):
   - Clear bottom-line conclusion based on the evidence
   - Key supporting facts from the most reliable/recent sources
   - Any important temporal context (e.g., "as of 2025")

CONFIDENCE SCALE:
95-100%: Multiple recent authoritative sources strongly confirm/deny with consensus
80-94%: Strong evidence from credible recent sources, minor uncertainties
60-79%: Moderate support, some gaps or older sources
40-59%: Conflicting information between sources or insufficient evidence
0-39%: Clearly contradicted by recent reliable sources

CRITICAL PRIORITY RULE for CURRENT STATUS claims (who holds office, current events, recent elections):
- Recent authoritative sources (2024-2025) are the primary basis for verdicts
- A president elected in 2024 and inaugurated in 2025 IS the current president
- Always note the temporal context in your explanation

REQUIRED OUTPUT FORMAT:
VERDICT: [TRUE/FALSE/UNCERTAIN]
CONFIDENCE: [0-100]
EXPLANATION: [800-1000 characters - Detailed analysis of the evidence. Explain what the sources show, why this confidence level, and any critical nuances. DO NOT mention training data or baseline knowledge.]
SUMMARY: [200-300 characters - Clear conclusion with key supporting facts from the evidence]

CRITICAL FORMATTING RULES:
- Base your entire analysis on the evidence provided
- DO NOT reference "training data", "my knowledge", "what I know", or similar phrases
- Present your analysis as a direct evaluation of the evidence sources
- For historical facts: analyze based on the evidence credibility
- For current events: prioritize the most recent and authoritative evidence
- Focus on WHAT THE EVIDENCE SHOWS, not what you know separately

Analyze now:`;

    return prompt;
  }

  async callLlama(prompt) {
    try {
      console.log(`   📡 Calling GPT OSS 120B Cloud via Ollama...`);
      console.log(`   ⏳ Estimated time: 10-20 seconds\n`);

      const progressInterval = this.startProgressIndicator();

      const response = await axios.post(`${this.ollamaHost}/api/generate`, {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          // OPTIMIZED for DETAILED analysis
          num_predict: 1500,      // Longer for comprehensive explanation
          temperature: 0.3,       // Balanced - not too creative, not too rigid
          top_p: 0.9,            // Allow detailed reasoning
          top_k: 40,             // Broad consideration
          repeat_penalty: 1.1,   // Minimal penalty for natural explanation
          stop: ["\n\n\n", "---END---"]
        }
      }, {
        timeout: 150000  // 2.5 minutes
      });

      clearInterval(progressInterval);
      console.log('\n');

      if (!response.data || !response.data.response) {
        throw new Error('Invalid response from Ollama');
      }

      const generatedText = response.data.response;
      console.log(`   📄 GPT Response (${generatedText.length} chars):`);
      console.log(`   ${'-'.repeat(70)}`);
      console.log(`   ${generatedText.substring(0, 400)}${generatedText.length > 400 ? '...' : ''}`);
      console.log(`   ${'-'.repeat(70)}\n`);

      return this.parseResponse(generatedText);
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`Cannot connect to Ollama at ${this.ollamaHost}. Is Ollama running?`);
      }
      throw error;
    }
  }

  startProgressIndicator() {
    const spinners = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    return setInterval(() => {
      process.stdout.write(`\r   ${spinners[i]} Processing...`);
      i = (i + 1) % spinners.length;
    }, 80);
  }

  parseResponse(text) {
    console.log('   🔍 Parsing GPT response...');

    let verdict = 'UNCERTAIN';
    let confidence = 50;
    let explanation = '';
    let summary = '';

    const cleanText = text.replace(/\*\*/g, '').replace(/\*/g, '');
    const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (/^VERDICT:?\s*(TRUE|FALSE|UNCERTAIN)/i.test(line)) {
        const match = line.match(/VERDICT:?\s*(TRUE|FALSE|UNCERTAIN)/i);
        if (match) {
          verdict = match[1].toUpperCase();
          console.log(`      ✓ Found verdict: ${verdict}`);
        }
      }
      
      if (/^CONFIDENCE:?\s*\d+/i.test(line)) {
        const match = line.match(/CONFIDENCE:?\s*(\d+)/i);
        if (match) {
          confidence = parseInt(match[1]);
          console.log(`      ✓ Found confidence: ${confidence}%`);
        }
      }
      
      if (/^EXPLANATION:?/i.test(line)) {
        let expText = line.replace(/^EXPLANATION:?\s*/i, '').trim();
        
        for (let j = i + 1; j < lines.length; j++) {
          if (/^(SUMMARY|REASONING|CONFIDENCE|VERDICT|NOTE):/i.test(lines[j])) {
            break;
          }
          expText += ' ' + lines[j];
        }
        
        explanation = expText.trim();
        if (explanation.length > 20) {
          console.log(`      ✓ Found explanation (${explanation.length} chars)`);
        }
      }
      
      if (/^SUMMARY:?/i.test(line)) {
        let sumText = line.replace(/^SUMMARY:?\s*/i, '').trim();
        
        for (let j = i + 1; j < lines.length; j++) {
          if (/^(REASONING|CONFIDENCE|EXPLANATION|VERDICT|NOTE):/i.test(lines[j])) {
            break;
          }
          sumText += ' ' + lines[j];
        }
        
        summary = sumText.trim();
        if (summary.length > 20) {
          console.log(`      ✓ Found summary (${summary.length} chars)`);
        }
      }
    }

    confidence = Math.max(0, Math.min(100, confidence));
    
    // Enforce minimum and maximum character limits
    if (explanation.length < 500) {
      console.log(`      ⚠️ Explanation too short (${explanation.length} chars), needs enrichment`);
    }
    
    if (explanation.length > 12000) {
      console.log(`      ⚠️ Explanation too long (${explanation.length} chars), truncating...`);
      explanation = explanation.substring(0, 1197) + '...';
    }
    
    if (summary.length < 150) {
      console.log(`      ⚠️ Summary too short (${summary.length} chars)`);
    }
    
    if (summary.length > 350) {
      console.log(`      ⚠️ Summary too long (${summary.length} chars), truncating...`);
      summary = summary.substring(0, 347) + '...';
    }
    
    if (!explanation || explanation.length < 100) {
      console.log('      ⚠️ Explanation critically short, using detailed fallback');
      explanation = `This claim has been analyzed against multiple authoritative sources. The evidence ${verdict === 'TRUE' ? 'strongly supports' : verdict === 'FALSE' ? 'contradicts' : 'shows mixed results for'} the claim. The confidence level of ${confidence}% reflects ${confidence >= 80 ? 'strong consensus across reliable sources' : confidence >= 60 ? 'moderate support with some reservations' : 'significant uncertainty or conflicting information'}. Key factors considered include source credibility, recency of information, and consistency across multiple references.`;
    }
    
    if (!summary || summary.length < 50) {
      console.log('      ⚠️ Summary critically short, using detailed fallback');
      summary = `Based on comprehensive analysis of authoritative sources, this claim is ${verdict === 'TRUE' ? 'confirmed as accurate' : verdict === 'FALSE' ? 'determined to be false' : 'inconclusive'} with ${confidence}% confidence.`;
    }

    const percentages = this.calculatePercentages(verdict, confidence);

    console.log('   ✅ Parsing complete\n');

    return {
      verdict,
      confidence,
      explanation,
      summary,
      percentages
    };
  }

  calculatePercentages(verdict, confidence) {
    let truePercentage, falsePercentage, uncertainPercentage;
    
    if (confidence >= 95) {
      if (verdict === 'TRUE') {
        truePercentage = Math.min(100, confidence + 2);
        falsePercentage = Math.max(0, Math.floor((100 - truePercentage) * 0.1));
        uncertainPercentage = 100 - truePercentage - falsePercentage;
      } else if (verdict === 'FALSE') {
        falsePercentage = Math.min(100, confidence + 2);
        truePercentage = Math.max(0, Math.floor((100 - falsePercentage) * 0.1));
        uncertainPercentage = 100 - falsePercentage - truePercentage;
      } else {
        uncertainPercentage = confidence;
        truePercentage = Math.round((100 - confidence) * 0.5);
        falsePercentage = 100 - uncertainPercentage - truePercentage;
      }
    }
    else if (confidence >= 85) {
      if (verdict === 'TRUE') {
        truePercentage = confidence;
        falsePercentage = Math.round((100 - confidence) * 0.15);
        uncertainPercentage = 100 - truePercentage - falsePercentage;
      } else if (verdict === 'FALSE') {
        falsePercentage = confidence;
        truePercentage = Math.round((100 - confidence) * 0.15);
        uncertainPercentage = 100 - falsePercentage - truePercentage;
      } else {
        uncertainPercentage = confidence;
        truePercentage = Math.round((100 - confidence) * 0.4);
        falsePercentage = 100 - uncertainPercentage - truePercentage;
      }
    }
    else {
      if (verdict === 'TRUE') {
        truePercentage = confidence;
        falsePercentage = Math.round((100 - confidence) * 0.25);
        uncertainPercentage = 100 - truePercentage - falsePercentage;
      } else if (verdict === 'FALSE') {
        falsePercentage = confidence;
        truePercentage = Math.round((100 - confidence) * 0.25);
        uncertainPercentage = 100 - falsePercentage - truePercentage;
      } else {
        uncertainPercentage = confidence;
        truePercentage = Math.round((100 - confidence) * 0.4);
        falsePercentage = 100 - uncertainPercentage - truePercentage;
      }
    }

    return {
      true: Math.max(0, Math.min(100, truePercentage)),
      false: Math.max(0, Math.min(100, falsePercentage)),
      uncertain: Math.max(0, Math.min(100, uncertainPercentage))
    };
  }

  fallbackAnalysis(claim, evidence) {
    console.log('   ⚠️ Using fallback rule-based analysis');

    const sources = evidence.sources;
    let trueCount = 0;
    let falseCount = 0;
    let uncertainCount = 0;

    sources.forEach(s => {
      const originalVerdict = s.originalVerdict || s.verdict || 'UNCERTAIN';
      if (originalVerdict.includes('TRUE') || originalVerdict.includes('SUPPORTED')) trueCount++;
      else if (originalVerdict.includes('FALSE') || originalVerdict.includes('REFUTED')) falseCount++;
      else uncertainCount++;
    });

    const total = sources.length || 1;
    
    let verdict = 'UNCERTAIN';
    let confidence = 50;

    if (trueCount > falseCount && trueCount / total >= 0.5) {
      verdict = 'TRUE';
      confidence = Math.round((trueCount / total) * 100);
    } else if (falseCount > trueCount && falseCount / total >= 0.5) {
      verdict = 'FALSE';
      confidence = Math.round((falseCount / total) * 100);
    }

    const percentages = this.calculatePercentages(verdict, confidence);

    return {
      verdict,
      confidence,
      explanation: `Based on ${total} sources: ${trueCount} support, ${falseCount} refute.`,
      summary: `Analysis shows ${trueCount} sources support, ${falseCount} refute the claim.`,
      percentages
    };
  }
}

module.exports = new LlamaOrchestrator();