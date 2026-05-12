const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ocrService = require('../services/ocrService');
const propagandaDetection = require('../services/propagandaDetection');
const directSourceChecker = require('../services/directSourceChecker');
const aiFactChecker = require('../services/aiFactChecker');

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// TEXT ANALYSIS ENDPOINT
router.post('/text', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is required' });
    }

    console.log('📝 Analyzing text:', text.substring(0, 100) + '...');

    // ========== STEP 1: DIRECT SOURCE VERIFICATION ==========
    console.log('🌐 Step 1: Checking PIB, WHO, UN, Wikipedia, News...');
    const directSources = await directSourceChecker.verifyFromAllSources(text);

    // Log what we found
    console.log('📊 Source Results:');
    directSources.sources.forEach(src => {
      console.log(`  - ${src.name}: ${src.verified ? '✓ Verified' : '✗ Not verified'} (checked: ${src.checked})`);
    });

    // ========== STEP 2: PROPAGANDA DETECTION ==========
    console.log('🎭 Step 2: Detecting propaganda...');
    const propagandaResults = propagandaDetection.analyze(text);

    // ========== STEP 3: AI SYNTHESIS ==========
    let aiResult = null;
    if (process.env.ANTHROPIC_API_KEY) {
      console.log('🤖 Step 3: AI synthesis of findings...');
      
      const sourceContext = [];
      directSources.sources.forEach(src => {
        sourceContext.push(`- ${src.name}: ${src.verified ? '✓ Verified' : '✗ Not verified'}`);
      });

      const contextForAI = `
Direct Source Verification Results:
${sourceContext.join('\n')}
- Official Confirmation: ${directSources.officialConfirmation ? 'YES' : 'NO'}
- Total Sources Checked: ${directSources.totalChecked}

Claim to verify: "${text}"
`;

      try {
        aiResult = await aiFactChecker.verifyFact(contextForAI);
      } catch (aiError) {
        console.error('⚠️ AI verification failed:', aiError.message);
        aiResult = { error: true };
      }
    } else {
      console.log('ℹ️ ANTHROPIC_API_KEY not set, skipping AI analysis');
    }

    // ========== STEP 4: IMPROVED RISK CALCULATION ==========
    let riskScore;
    let verdict;
    let confidenceLevel = 'medium';

    // Count verified sources with stricter criteria
    const verifiedSources = directSources.sources.filter(s => s.verified && s.checked);
    const checkedSources = directSources.sources.filter(s => s.checked);
    const verificationRate = checkedSources.length > 0 ? verifiedSources.length / checkedSources.length : 0;

    console.log(`📈 Verification Rate: ${verifiedSources.length}/${checkedSources.length} = ${(verificationRate * 100).toFixed(0)}%`);
    
    // Log each source's verification status for debugging
    console.log('📋 Source Verification Details:');
    directSources.sources.forEach(src => {
      if (src.checked) {
        console.log(`   ${src.verified ? '✅' : '❌'} ${src.name}: ${src.verified ? 'VERIFIED' : 'NOT VERIFIED'}`);
      }
    });

    // Calculate base risk score from sources
    if (verifiedSources.length >= 3) {
      // Multiple sources confirm - very low risk
      riskScore = 15;
      verdict = 'Very Low Risk - Multiple Sources Confirm';
      confidenceLevel = 'high';
    } else if (verifiedSources.length === 2) {
      // Two sources confirm - low risk
      riskScore = 25;
      verdict = 'Low Risk - Confirmed by Multiple Sources';
      confidenceLevel = 'high';
    } else if (verifiedSources.length === 1) {
      // One source confirms - medium risk
      riskScore = 45;
      verdict = 'Medium Risk - Limited Source Confirmation';
      confidenceLevel = 'medium';
    } else if (checkedSources.length > 0) {
      // Sources checked but none confirmed - high risk
      riskScore = 75;
      verdict = 'High Risk - No Source Confirmation';
      confidenceLevel = 'medium';
    } else {
      // No sources could be checked - medium-high risk
      riskScore = 60;
      verdict = 'Medium-High Risk - Unable to Verify';
      confidenceLevel = 'low';
    }

    // Adjust for propaganda indicators
    const avgPropaganda = (
      propagandaResults.emotionalLanguage + 
      propagandaResults.fearBased + 
      propagandaResults.bias
    ) / 3;

    if (avgPropaganda > 50) {
      console.log(`⚠️ High propaganda detected (${avgPropaganda.toFixed(0)}%), increasing risk`);
      riskScore = Math.min(riskScore + Math.round(avgPropaganda * 0.3), 95);
      
      if (avgPropaganda > 70) {
        verdict = 'Very High Risk - Strong Propaganda Detected';
      }
    }

    // Adjust based on AI if available
    if (aiResult && !aiResult.error) {
      console.log(`🤖 AI Verdict: ${aiResult.verdict} (${aiResult.confidence}% confidence)`);
      const aiRisk = aiFactChecker.verdictToRiskScore(aiResult.verdict, aiResult.confidence);
      
      // Weight: 60% sources, 40% AI
      const oldScore = riskScore;
      riskScore = Math.round((riskScore * 0.6) + (aiRisk * 0.4));
      console.log(`📊 Risk adjusted: ${oldScore} → ${riskScore} (AI contribution)`);
      
      // Update verdict based on AI analysis
      if (aiResult.verdict === 'True' && aiResult.confidence > 80) {
        verdict = 'Low Risk - AI Verified as True';
        confidenceLevel = 'high';
      } else if (aiResult.verdict === 'Fake' && aiResult.confidence > 80) {
        verdict = 'Very High Risk - AI Marked as Fake';
        confidenceLevel = 'high';
      } else if (aiResult.verdict === 'Misleading') {
        verdict = 'High Risk - Misleading Content Detected';
      }
    }

    // Ensure score is within bounds
    riskScore = Math.max(0, Math.min(100, riskScore));

    // ========== STEP 5: GENERATE DETAILED EXPLANATION ==========
    const explanation = [];

    // Source verification explanations
    if (verifiedSources.length >= 2) {
      explanation.push(`✅ Claim verified by ${verifiedSources.length} reliable sources:`);
      verifiedSources.forEach(src => {
        explanation.push(`   • ${src.name}${src.url ? ` (${src.url})` : ''}`);
      });
    } else if (verifiedSources.length === 1) {
      explanation.push(`⚠️ Claim verified by only 1 source: ${verifiedSources[0].name}`);
      explanation.push(`   Recommendation: Seek additional confirmation`);
    } else if (checkedSources.length > 0) {
      explanation.push(`❌ No confirmation from ${checkedSources.length} checked sources`);
      explanation.push(`   Sources checked: ${checkedSources.map(s => s.name).join(', ')}`);
    } else {
      explanation.push('⚠️ Unable to verify with any sources');
    }

    // Propaganda analysis
    if (propagandaResults.emotionalLanguage > 60) {
      explanation.push(`⚠️ High emotional language (${propagandaResults.emotionalLanguage}%) - potential manipulation`);
    }
    if (propagandaResults.fearBased > 60) {
      explanation.push(`⚠️ Fear-based messaging (${propagandaResults.fearBased}%) - common in misinformation`);
    }
    if (propagandaResults.bias > 60) {
      explanation.push(`⚠️ Biased framing (${propagandaResults.bias}%) - lacks objectivity`);
    }

    // AI analysis
    if (aiResult && !aiResult.error) {
      explanation.push('');
      explanation.push(`🤖 AI Analysis (${aiResult.confidence}% confidence):`);
      explanation.push(`   ${aiResult.explanation}`);
      
      if (aiResult.keyFindings && aiResult.keyFindings.length > 0) {
        explanation.push('');
        explanation.push('Key Findings:');
        aiResult.keyFindings.forEach(finding => {
          explanation.push(`   • ${finding}`);
        });
      }

      if (aiResult.sources && aiResult.sources.length > 0) {
        explanation.push('');
        explanation.push('AI Sources Consulted:');
        aiResult.sources.slice(0, 3).forEach(source => {
          explanation.push(`   • ${source.name}${source.url ? `: ${source.url}` : ''}`);
        });
      }
    }

    // Add recommendation
    explanation.push('');
    if (riskScore < 30) {
      explanation.push('✅ Recommendation: Claim appears credible based on multiple sources');
    } else if (riskScore < 50) {
      explanation.push('⚠️ Recommendation: Exercise caution, verify with additional sources');
    } else if (riskScore < 70) {
      explanation.push('⚠️ Recommendation: Treat with skepticism, likely unreliable');
    } else {
      explanation.push('❌ Recommendation: High likelihood of misinformation - do not share');
    }

    // ========== STEP 6: PREPARE RESPONSE ==========
    const response = {
      riskScore,
      verdict,
      confidenceLevel,
      explanation,
      sourcesChecked: directSources.sources.map(s => ({
        name: s.name,
        verified: s.verified,
        checked: s.checked,
        type: s.type,
        url: s.url || null
      })),
      propagandaIndicators: propagandaResults,
      verificationSummary: {
        totalSourcesChecked: checkedSources.length,
        verifiedSources: verifiedSources.length,
        verificationRate: Math.round(verificationRate * 100),
        officialConfirmation: directSources.officialConfirmation
      },
      aiAnalysis: aiResult && !aiResult.error ? {
        verdict: aiResult.verdict,
        confidence: aiResult.confidence,
        sources: aiResult.sources || [],
        searchPerformed: aiResult.searchPerformed,
        powered: 'Claude AI'
      } : null,
      timestamp: new Date().toISOString()
    };

    console.log(`✅ Analysis complete. Risk Score: ${riskScore} (${verdict})`);
    res.json(response);

  } catch (error) {
    console.error('❌ Analysis error:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Analysis failed', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// IMAGE ANALYSIS ENDPOINT
router.post('/image', upload.single('image'), async (req, res) => {
  let filePath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image is required' });
    }

    filePath = req.file.path;
    console.log('🖼️ Processing image:', req.file.filename);

    const extractedText = await ocrService.extractText(filePath);
    
    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ error: 'No text found in image' });
    }

    console.log('✅ Extracted text:', extractedText.substring(0, 100) + '...');
    
    // Use same verification flow as text
    const directSources = await directSourceChecker.verifyFromAllSources(extractedText);
    const propagandaResults = propagandaDetection.analyze(extractedText);
    
    // Calculate risk score (same logic as text endpoint)
    const verifiedSources = directSources.sources.filter(s => s.verified && s.checked);
    const checkedSources = directSources.sources.filter(s => s.checked);
    
    let riskScore;
    let verdict;

    if (verifiedSources.length >= 3) {
      riskScore = 15;
      verdict = 'Very Low Risk - Multiple Sources Confirm';
    } else if (verifiedSources.length === 2) {
      riskScore = 25;
      verdict = 'Low Risk - Confirmed by Multiple Sources';
    } else if (verifiedSources.length === 1) {
      riskScore = 45;
      verdict = 'Medium Risk - Limited Source Confirmation';
    } else if (checkedSources.length > 0) {
      riskScore = 75;
      verdict = 'High Risk - No Source Confirmation';
    } else {
      riskScore = 60;
      verdict = 'Medium-High Risk - Unable to Verify';
    }

    // Adjust for propaganda
    const avgPropaganda = (
      propagandaResults.emotionalLanguage + 
      propagandaResults.fearBased + 
      propagandaResults.bias
    ) / 3;

    if (avgPropaganda > 50) {
      riskScore = Math.min(riskScore + Math.round(avgPropaganda * 0.3), 95);
    }

    // Generate explanation
    const explanation = [];
    if (verifiedSources.length >= 2) {
      explanation.push(`✅ Verified by ${verifiedSources.length} sources`);
    } else if (verifiedSources.length === 1) {
      explanation.push(`⚠️ Verified by only 1 source`);
    } else {
      explanation.push(`❌ No source confirmation found`);
    }

    if (propagandaResults.emotionalLanguage > 60) {
      explanation.push('⚠️ Emotional language detected');
    }
    if (propagandaResults.fearBased > 60) {
      explanation.push('⚠️ Fear-based content detected');
    }
    
    res.json({
      extractedText,
      riskScore,
      verdict,
      explanation,
      sourcesChecked: directSources.sources,
      propagandaIndicators: propagandaResults,
      verificationSummary: {
        totalSourcesChecked: checkedSources.length,
        verifiedSources: verifiedSources.length,
        officialConfirmation: directSources.officialConfirmation
      }
    });

  } catch (error) {
    console.error('❌ Image analysis error:', error);
    res.status(500).json({ 
      error: 'Image analysis failed', 
      details: error.message 
    });
  } finally {
    // Clean up uploaded file
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log('🗑️ Cleaned up temporary file');
      } catch (cleanupError) {
        console.error('⚠️ Failed to cleanup file:', cleanupError);
      }
    }
  }
});

module.exports = router;