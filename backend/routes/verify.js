// backend/routes/verify.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const pdf = require('pdf-parse'); // NEW: For PDF extraction
const axios = require('axios'); // NEW: For LLaMA splitting

const sourceAggregator = require('../services/sourceAggregator');
const llamaOrchestrator = require('../services/llamaOrchestrator');

// UPDATED: Support multiple files instead of single image
const upload = multer({ 
  dest: 'uploads/', 
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf', 'text/plain'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// POST /api/verify-claim
// UPDATED: Changed from upload.single('image') to upload.array('files', 10)
router.post('/verify-claim', upload.array('files', 10), async (req, res) => {
  let filePath = null;
  let filePaths = []; // NEW: Track multiple files
  const startTime = Date.now();

  try {
    let claim = req.body.claim;

    // NEW: Handle multiple file uploads
    if (req.files && req.files.length > 0) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📁 PROCESSING ${req.files.length} FILE(S)`);
      console.log(`${'='.repeat(80)}\n`);

      let extractedTexts = [];

      for (const file of req.files) {
        filePaths.push(file.path);
        
        try {
          if (file.mimetype.startsWith('image/')) {
            // Image OCR
            console.log(`🖼️  Processing image: ${file.originalname}`);
            const { data: { text } } = await Tesseract.recognize(file.path, 'eng', {
              logger: m => {
                if (m.status === 'recognizing text') {
                  console.log(`   OCR Progress: ${Math.round(m.progress * 100)}%`);
                }
              }
            });
            
            if (text && text.trim().length > 10) {
              extractedTexts.push(text.trim());
              console.log(`   ✅ Extracted ${text.trim().length} characters from ${file.originalname}\n`);
            }
          } 
          else if (file.mimetype === 'application/pdf') {
            // PDF extraction
            console.log(`📄 Processing PDF: ${file.originalname}`);
            const dataBuffer = fs.readFileSync(file.path);
            const pdfData = await pdf(dataBuffer);
            
            if (pdfData.text && pdfData.text.trim().length > 10) {
              extractedTexts.push(pdfData.text.trim());
              console.log(`   ✅ Extracted ${pdfData.text.trim().length} characters from ${file.originalname}\n`);
            }
          }
          else if (file.mimetype === 'text/plain') {
            // Text file
            console.log(`📝 Processing text file: ${file.originalname}`);
            const textContent = fs.readFileSync(file.path, 'utf8');
            
            if (textContent && textContent.trim().length > 10) {
              extractedTexts.push(textContent.trim());
              console.log(`   ✅ Read ${textContent.trim().length} characters from ${file.originalname}\n`);
            }
          }
        } catch (fileError) {
          console.error(`   ❌ Error processing ${file.originalname}:`, fileError.message);
        }
      }

      if (extractedTexts.length === 0) {
        return res.status(400).json({
          error: 'Could not extract text from any uploaded files',
          suggestion: 'Please upload clearer files or type the claim manually'
        });
      }

      claim = extractedTexts.join('\n\n');

      // NEW: PRINT EXTRACTED TEXT TO TERMINAL
      console.log(`${'='.repeat(80)}`);
      console.log(`📄 EXTRACTED TEXT FROM ALL FILES`);
      console.log(`${'='.repeat(80)}\n`);
      console.log(claim);
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Total: ${claim.length} characters from ${extractedTexts.length} file(s)`);
      console.log(`${'='.repeat(80)}\n`);
    }
    // ORIGINAL CODE: Single image handling (keeping for backward compatibility)
    else if (req.file) {
      filePath = req.file.path;
      console.log('🖼️  Processing image with OCR...');
      
      const { data: { text } } = await Tesseract.recognize(filePath, 'eng', {
        logger: m => console.log(`   OCR Progress: ${m.status} ${m.progress ? Math.round(m.progress * 100) + '%' : ''}`)
      });
      
      claim = text.trim();
      
      if (!claim || claim.length < 10) {
        return res.status(400).json({
          error: 'Unable to extract meaningful text from image',
          suggestion: 'Please upload a clearer image or type the claim manually'
        });
      }
      
      console.log(`✅ Extracted: ${claim.substring(0, 100)}...`);
    }

    if (!claim || claim.trim().length === 0) {
      return res.status(400).json({ error: 'Claim text is required' });
    }

    claim = claim.trim();

    // NEW: If text is long, ask LLaMA to intelligently split it
    let statementsToVerify = [claim];
    
    if (claim.length > 200) { // Only split if text is substantial
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🤖 ASKING LLAMA TO INTELLIGENTLY SPLIT TEXT INTO CLAIMS`);
      console.log(`${'='.repeat(80)}\n`);

      const llamaSplitStatements = await askLlamaToSplit(claim);
      
      if (llamaSplitStatements && llamaSplitStatements.length > 1) {
        statementsToVerify = llamaSplitStatements;
        
        console.log(`\n${'='.repeat(80)}`);
        console.log(`✅ LLAMA IDENTIFIED ${statementsToVerify.length} VERIFIABLE CLAIM(S)`);
        console.log(`${'='.repeat(80)}\n`);
        
        statementsToVerify.forEach((stmt, idx) => {
          console.log(`[${idx + 1}] ${stmt}\n`);
        });
      }
    }

    // NEW: If LLaMA split into multiple claims, verify each one
    if (statementsToVerify.length > 1 && statementsToVerify.length <= 20) {
      return await verifyMultipleStatements(statementsToVerify, claim, startTime, res);
    }

    // ORIGINAL CODE: Single claim verification (unchanged)
    // STEP 2: Content type detection
    const contentType = detectContentType(claim);
    if (contentType !== 'factual') {
      return res.json({
        verdict: 'NOT_VERIFIABLE',
        confidence: 0,
        percentages: { true: 0, false: 0, uncertain: 100 },
        explanation: `This appears to be ${contentType} content, not a factual claim that can be verified.`,
        summary: 'No verification performed for non-factual content.',
        sources: [],
        metadata: { contentType, processingTime: Date.now() - startTime }
      });
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 VERIFYING CLAIM: "${claim.substring(0, 80)}..."`);
    console.log(`${'='.repeat(60)}\n`);

    // STEP 3: Aggregate evidence from ALL sources
    console.log('📡 Fetching evidence from all sources...\n');
    const aggregatedEvidence = await sourceAggregator.gatherAllEvidence(claim);

    // Print all gathered evidence to backend console
    printEvidenceToBackend(aggregatedEvidence);

    // STEP 4: LLaMA Analysis
    console.log('\n🦙 Analyzing with LLaMA 3.1...\n');
    const llamaAnalysis = await llamaOrchestrator.analyzeWithLlama(claim, aggregatedEvidence);

    // STEP 5: Build response - sources without individual verdicts
    const response = {
      verdict: llamaAnalysis.verdict,
      confidence: llamaAnalysis.confidence,
      percentages: llamaAnalysis.percentages,
      explanation: llamaAnalysis.explanation,
      summary: llamaAnalysis.summary,
      sources: aggregatedEvidence.sources.map(s => ({
        name: s.name,
        type: s.type,
        url: s.url,
        excerpt: s.excerpt ? s.excerpt.substring(0, 250) + '...' : null
      })),
      metadata: {
        totalSources: aggregatedEvidence.sources.length,
        sourcesChecked: aggregatedEvidence.sourcesChecked,
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }
    };

    console.log('\n' + '='.repeat(60));
    console.log('✅ VERIFICATION COMPLETE');
    console.log(`Verdict: ${response.verdict} (${response.confidence}%)`);
    console.log(`Processing Time: ${(response.metadata.processingTime / 1000).toFixed(2)}s`);
    console.log('='.repeat(60) + '\n');

    res.json(response);

  } catch (error) {
    console.error('❌ Verification error:', error);
    res.status(500).json({
      verdict: 'ERROR',
      confidence: 0,
      percentages: { true: 0, false: 0, uncertain: 0 },
      explanation: 'An error occurred during verification. Please try again.',
      summary: 'Verification could not be completed.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      metadata: { processingTime: Date.now() - startTime }
    });
  } finally {
    // ORIGINAL CODE: Cleanup uploaded file
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    // NEW: Cleanup multiple files
    filePaths.forEach(fp => {
      if (fs.existsSync(fp)) {
        try {
          fs.unlinkSync(fp);
        } catch (e) {
          console.error('Error deleting file:', fp);
        }
      }
    });
  }
});

// NEW FUNCTION: Ask LLaMA to intelligently split text
async function askLlamaToSplit(text) {
  const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
  const model = 'gpt-oss:120b-cloud';

  const prompt = `You are an expert fact-checker with critical thinking skills. Analyze the following text and extract ONLY the verifiable factual claims.

TEXT TO ANALYZE:
"""
${text}
"""

INSTRUCTIONS:
1. Use your critical thinking to identify factual claims that can be verified
2. Ignore: opinions, questions, headers, titles, page numbers, advertisements
3. Each claim must be a complete, standalone verifiable statement
4. Keep claims concise but complete
5. Maximum 20 claims
6. If only one claim exists, return just that one

FORMAT (one claim per line, numbered):
1. [First verifiable claim]
2. [Second verifiable claim]

Extract the claims now:`;

  try {
    console.log('   🧠 LLaMA is using critical thinking to analyze and split the text...\n');
    
    const response = await axios.post(`${ollamaHost}/api/generate`, {
      model: model,
      prompt: prompt,
      stream: false,
      options: {
        num_predict: 2000,
        temperature: 0.3,
        top_p: 0.9
      }
    }, {
      timeout: 120000
    });

    if (!response.data || !response.data.response) {
      console.log('   ⚠️  LLaMA splitting failed, using original text\n');
      return [text];
    }

    const llamaResponse = response.data.response;
    
    console.log(`   📋 LLaMA's Critical Analysis:\n`);
    console.log(`   ${'-'.repeat(70)}`);
    console.log(`   ${llamaResponse.substring(0, 500)}${llamaResponse.length > 500 ? '...' : ''}`);
    console.log(`   ${'-'.repeat(70)}\n`);

    // Parse LLaMA's response
    const lines = llamaResponse.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const claims = [];

    for (const line of lines) {
      const match = line.match(/^\d+[\.\)]\s*(.+)$/) || line.match(/^[-•*]\s*(.+)$/);
      if (match && match[1]) {
        const claim = match[1].trim();
        if (claim.length > 15 && !claim.match(/^(note|example|instructions?):/i)) {
          claims.push(claim);
        }
      }
    }

    if (claims.length === 0) {
      console.log('   ⚠️  No claims extracted, using original text\n');
      return [text];
    }

    return claims.slice(0, 20);

  } catch (error) {
    console.error('   ❌ LLaMA splitting error:', error.message);
    return [text];
  }
}

// NEW FUNCTION: Verify multiple statements identified by LLaMA
async function verifyMultipleStatements(statements, originalText, startTime, res) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 VERIFYING ${statements.length} STATEMENTS IDENTIFIED BY LLAMA`);
  console.log(`${'='.repeat(80)}\n`);

  const lineResults = [];

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    console.log(`\n[${ i + 1}/${statements.length}] Verifying: "${statement.substring(0, 80)}..."\n`);

    try {
      const contentType = detectContentType(statement);
      if (contentType !== 'factual') {
        lineResults.push({
          text: statement,
          verdict: 'NOT_VERIFIABLE',
          confidence: 0,
          explanation: `This is ${contentType} content, not verifiable.`,
          sources: 0
        });
        console.log(`   ⚠️  Skipped (${contentType})\n`);
        continue;
      }

      const aggregatedEvidence = await sourceAggregator.gatherAllEvidence(statement);
      const llamaAnalysis = await llamaOrchestrator.analyzeWithLlama(statement, aggregatedEvidence);

      lineResults.push({
        text: statement,
        verdict: llamaAnalysis.verdict,
        confidence: llamaAnalysis.confidence,
        explanation: llamaAnalysis.summary || llamaAnalysis.explanation.substring(0, 200),
        sources: aggregatedEvidence.totalSources
      });

      console.log(`   ✅ Result: ${llamaAnalysis.verdict} (${llamaAnalysis.confidence}%)\n`);
    } catch (error) {
      console.error(`   ❌ Error:`, error.message);
      lineResults.push({
        text: statement,
        verdict: 'ERROR',
        confidence: 0,
        explanation: 'Verification error',
        sources: 0
      });
    }
  }

  // Calculate overall verdict
  let trueCount = 0, falseCount = 0, uncertainCount = 0, totalConf = 0;
  
  lineResults.forEach(line => {
    if (line.verdict === 'TRUE') trueCount++;
    else if (line.verdict === 'FALSE') falseCount++;
    else uncertainCount++;
    totalConf += line.confidence || 0;
  });

  const total = lineResults.length || 1;
  const avgConf = Math.round(totalConf / total);
  
  let overallVerdict = 'UNCERTAIN';
  if ((trueCount / total) >= 0.7) overallVerdict = 'TRUE';
  else if ((falseCount / total) >= 0.7) overallVerdict = 'FALSE';

  const percentages = {
    true: Math.round((trueCount / total) * 100),
    false: Math.round((falseCount / total) * 100),
    uncertain: Math.round((uncertainCount / total) * 100)
  };

  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ MULTI-STATEMENT VERIFICATION COMPLETE`);
  console.log(`Overall: ${overallVerdict} (${avgConf}%)`);
  console.log(`Results: ${trueCount} true, ${falseCount} false, ${uncertainCount} uncertain`);
  console.log(`${'='.repeat(80)}\n`);

  res.json({
    verdict: overallVerdict,
    confidence: avgConf,
    percentages: percentages,
    explanation: `Analyzed ${total} statements: ${trueCount} verified as true, ${falseCount} as false, ${uncertainCount} uncertain.`,
    summary: `LLaMA identified and verified ${total} claims from the text.`,
    lineAnalysis: lineResults,
    sources: [],
    metadata: {
      totalStatements: total,
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    }
  });
}

// ORIGINAL FUNCTION: Detect content type (unchanged)
function detectContentType(text) {
  const lowerText = text.toLowerCase();
  
  // Opinion indicators
  if (lowerText.match(/\b(i think|i believe|in my opinion|i feel|should|ought to|must)\b/)) {
    return 'opinion';
  }
  
  // Satire indicators
  if (lowerText.match(/\b(allegedly|reportedly|sources say)\b/) && 
      lowerText.match(/\b(shocking|unbelievable|you won't believe)\b/)) {
    return 'satire';
  }
  
  // Question
  if (text.trim().endsWith('?')) {
    return 'question';
  }
  
  return 'factual';
}

// ORIGINAL FUNCTION: Print evidence to backend console (unchanged)
function printEvidenceToBackend(evidence) {
  console.log('\n📋 EVIDENCE GATHERED FROM SOURCES:\n');
  console.log('='.repeat(80));
  
  evidence.sources.forEach((source, idx) => {
    console.log(`\n[${idx + 1}] ${source.name} (${source.type})`);
    console.log(`    Original Verdict: ${source.originalVerdict || source.verdict || 'N/A'}`);
    console.log(`    LLaMA Verdict: ${source.verdict || 'Pending...'} | Confidence: ${source.confidence || 0}%`);
    console.log(`    URL: ${source.url || 'N/A'}`);
    
    if (source.llamaAnalysis) {
      console.log(`    LLaMA Analysis: ${source.llamaAnalysis}`);
    }
    
    if (source.fullText) {
      console.log(`\n    --- FULL TEXT (${source.fullText.length} chars) ---`);
      console.log(`    ${source.fullText.substring(0, 500)}...`);
      console.log(`    --- END TEXT ---\n`);
    }
    
    if (source.excerpt) {
      console.log(`    Excerpt: ${source.excerpt.substring(0, 200)}...`);
    }
    
    console.log('-'.repeat(80));
  });
  
  console.log(`\n✅ Total sources checked: ${evidence.sourcesChecked}`);
  console.log(`✅ Sources with evidence: ${evidence.sources.filter(s => s.hasEvidence).length}`);
  console.log('='.repeat(80));
}

// ORIGINAL FUNCTION: Calculate percentages for ring chart (unchanged)
function calculatePercentages(llamaAnalysis, evidence) {
  // Aggregate all source verdicts
  const verdicts = evidence.sources
    .filter(s => s.verdict)
    .map(s => ({ verdict: s.verdict, confidence: s.confidence || 50 }));
  
  let trueScore = 0;
  let falseScore = 0;
  let uncertainScore = 0;
  
  verdicts.forEach(v => {
    const weight = v.confidence / 100;
    if (v.verdict === 'TRUE' || v.verdict === 'SUPPORTED') {
      trueScore += weight;
    } else if (v.verdict === 'FALSE' || v.verdict === 'REFUTED') {
      falseScore += weight;
    } else {
      uncertainScore += weight;
    }
  });
  
  // Factor in LLaMA's verdict
  const llamaWeight = llamaAnalysis.confidence / 100;
  if (llamaAnalysis.verdict === 'TRUE') {
    trueScore += llamaWeight * 2; // LLaMA has higher weight
  } else if (llamaAnalysis.verdict === 'FALSE') {
    falseScore += llamaWeight * 2;
  } else {
    uncertainScore += llamaWeight * 2;
  }
  
  const total = trueScore + falseScore + uncertainScore || 1;
  
  return {
    true: Math.round((trueScore / total) * 100),
    false: Math.round((falseScore / total) * 100),
    uncertain: Math.round((uncertainScore / total) * 100)
  };
}

module.exports = router;