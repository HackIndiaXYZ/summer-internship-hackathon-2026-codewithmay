import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle, XCircle, Info, ExternalLink, Clock, Shield, TrendingUp, Database, Moon, Sun, Upload, X } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const FactCheckingSystem = () => {
  const [claim, setClaim] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  
  const summaryRef = useRef(null);
  const howItWorksRef = useRef(null);
  const fileInputRef = useRef(null);

  const verifyClaim = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      if (!claim.trim() && uploadedFiles.length === 0) {
        setError('Please enter a claim or upload a file');
        setLoading(false);
        return;
      }

      const formData = new FormData();
      
      if (uploadedFiles.length > 0) {
        uploadedFiles.forEach(file => {
          formData.append('files', file);
        });
      } else {
        formData.append('claim', claim);
      }

      const response = await fetch('http://localhost:5000/api/verify-claim', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Verification failed');
      }

      const data = await response.json();
      setResult(data);
      
      setTimeout(() => {
        summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    } catch (err) {
      setError('Failed to verify claim. Please ensure the backend server is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    const validFiles = files.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isPDF = file.type === 'application/pdf';
      const isTxt = file.type === 'text/plain';
      const isUnder10MB = file.size <= 10 * 1024 * 1024;
      return (isImage || isPDF || isTxt) && isUnder10MB;
    });
    setUploadedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const TypingText = ({ text, speed = 15 }) => {
    const [displayText, setDisplayText] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
      if (currentIndex < text.length) {
        const timeout = setTimeout(() => {
          setDisplayText(prev => prev + text[currentIndex]);
          setCurrentIndex(prev => prev + 1);
        }, speed);
        return () => clearTimeout(timeout);
      }
    }, [currentIndex, text, speed]);

    return <span>{displayText}</span>;
  };

  const scrollToHowItWorks = () => {
    howItWorksRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const getVerdictColor = (verdict) => {
    if (darkMode) {
      switch(verdict) {
        case 'TRUE': return 'bg-green-900 border-green-600 text-green-200';
        case 'FALSE': return 'bg-red-900 border-red-600 text-red-200';
        case 'UNCERTAIN': return 'bg-yellow-900 border-yellow-600 text-yellow-200';
        case 'NOT_VERIFIABLE': return 'bg-gray-800 border-gray-600 text-gray-300';
        default: return 'bg-gray-800 border-gray-600 text-gray-300';
      }
    }
    switch(verdict) {
      case 'TRUE': return 'bg-green-100 border-green-500 text-green-800';
      case 'FALSE': return 'bg-red-100 border-red-500 text-red-800';
      case 'UNCERTAIN': return 'bg-yellow-100 border-yellow-500 text-yellow-800';
      case 'NOT_VERIFIABLE': return 'bg-gray-100 border-gray-500 text-gray-800';
      default: return 'bg-gray-100 border-gray-500 text-gray-800';
    }
  };

  const getVerdictIcon = (verdict) => {
    switch(verdict) {
      case 'TRUE': return <CheckCircle className="w-8 h-8 text-green-600" />;
      case 'FALSE': return <XCircle className="w-8 h-8 text-red-600" />;
      case 'UNCERTAIN': return <AlertCircle className="w-8 h-8 text-yellow-600" />;
      case 'NOT_VERIFIABLE': return <Info className="w-8 h-8 text-gray-600" />;
      default: return <Info className="w-8 h-8 text-gray-600" />;
    }
  };

  const getConfidenceLabel = (confidence) => {
    if (confidence >= 80) return 'Very High';
    if (confidence >= 60) return 'High';
    if (confidence >= 40) return 'Moderate';
    if (confidence >= 20) return 'Low';
    return 'Very Low';
  };

  const getRingChartData = () => {
    if (!result || !result.percentages) return [];
    
    const data = [
      { name: 'True', value: result.percentages.true, color: '#10b981' },
      { name: 'False', value: result.percentages.false, color: '#ef4444' },
      { name: 'Uncertain', value: result.percentages.uncertain, color: '#f59e0b' }
    ].filter(item => item.value > 0);
    
    return data;
  };

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
    const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);

    return (
      <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="font-bold">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const getSourceIcon = (type) => {
    if (!type) return <Info className="w-5 h-5 text-gray-600" />;
    if (type === 'fact-check') return <Shield className="w-5 h-5 text-indigo-600" />;
    if (type === 'encyclopedia') return <Database className="w-5 h-5 text-purple-600" />;
    if (type === 'news') return <TrendingUp className="w-5 h-5 text-blue-600" />;
    if (type === 'global-events') return <TrendingUp className="w-5 h-5 text-green-600" />;
    if (type.includes('ml-')) return <AlertCircle className="w-5 h-5 text-pink-600" />;
    return <Info className="w-5 h-5 text-gray-600" />;
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 via-white to-indigo-50'} transition-colors duration-300`}>
      <nav className={`sticky top-0 z-50 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b shadow-md transition-colors duration-300`}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className={`w-6 h-6 ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
            <span className={`font-bold text-lg ${darkMode ? 'text-white' : 'text-gray-800'}`}>Fact-Checker</span>
          </div>
          
          <div className="flex items-center space-x-4">
            <button onClick={scrollToHowItWorks} className={`px-4 py-2 rounded-lg font-medium transition-colors ${darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}>
              How It Works
            </button>
            
            <button onClick={() => setDarkMode(!darkMode)} className={`p-2 rounded-lg transition-colors ${darkMode ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`} aria-label="Toggle dark mode">
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>
      
      <div className="max-w-6xl mx-auto p-4">
        <div className="text-center mb-8 pt-8">
          <div className="flex items-center justify-center mb-4">
            <Shield className={`w-12 h-12 ${darkMode ? 'text-indigo-400' : 'text-indigo-600'} mr-3`} />
            <h1 className={`text-4xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Advanced Fact-Checking System</h1>
          </div>
          <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'} max-w-2xl mx-auto`}>
            Multi-source evidence verification powered by LLaMA 3.1, ML models, and authoritative sources
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            <span className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full">Google Fact Check</span>
            <span className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full">Wikipedia Deep Fetch</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full">News API</span>
            <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full">GDELT</span>
            <span className="text-xs bg-pink-100 text-pink-700 px-3 py-1 rounded-full">ML Models (BART, DeBERTa, RoBERTa)</span>
            <span className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full">LLaMA 3.1</span>
          </div>
        </div>

        <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'} rounded-xl shadow-lg p-6 mb-6 ${darkMode ? 'border' : ''}`}>
          <h2 className={`text-2xl font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Submit Claim for Verification</h2>
          
          <div className="mb-4">
            <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>Enter Claim to Verify</label>
            <textarea
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              placeholder="Enter a factual claim (e.g., 'The Earth orbits the Sun' or 'Coffee helps reduce the risk of diabetes')"
              className={`w-full h-32 p-3 border ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none`}
              disabled={uploadedFiles.length > 0}
            />
          </div>

          {/* File Upload Section - Minimal Addition */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Or upload files (Images, PDFs, Text)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.txt"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`text-sm px-3 py-1 rounded-lg flex items-center space-x-1 ${darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} transition-colors`}
              >
                <Upload className="w-4 h-4" />
                <span>Choose Files</span>
              </button>
            </div>

            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                {uploadedFiles.map((file, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-2 ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'} border rounded-lg`}
                  >
                    <div className="flex items-center space-x-2 flex-1">
                      <Upload className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                      <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'} truncate`}>
                        {file.name}
                      </span>
                      <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                        ({formatFileSize(file.size)})
                      </span>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className={`p-1 rounded ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'} transition-colors`}
                    >
                      <X className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={verifyClaim}
            disabled={(!claim.trim() && uploadedFiles.length === 0) || loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Verifying with AI...
              </>
            ) : (
              <>
                <Shield className="w-5 h-5 mr-2" />
                Verify Claim
              </>
            )}
          </button>
        </div>

        {error && (
          <div className={`${darkMode ? 'bg-red-900 border-red-700' : 'bg-red-50 border-red-500'} border-l-4 p-4 rounded mb-6`}>
            <div className="flex">
              <XCircle className={`w-5 h-5 ${darkMode ? 'text-red-400' : 'text-red-500'} mr-3 flex-shrink-0 mt-0.5`} />
              <div>
                <p className={`text-sm ${darkMode ? 'text-red-200' : 'text-red-700'} font-medium`}>Error</p>
                <p className={`text-sm ${darkMode ? 'text-red-300' : 'text-red-600'} mt-1`}>{error}</p>
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-6">
            {/* Line-by-Line Analysis - Only show if exists */}
            {result.lineAnalysis && result.lineAnalysis.length > 0 && (
              <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'} rounded-xl shadow-lg p-6 ${darkMode ? 'border' : ''}`}>
                <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'} mb-4`}>
                  Line-by-Line Analysis ({result.lineAnalysis.length} statements)
                </h3>
                <div className="space-y-3">
                  {result.lineAnalysis.map((line, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border-l-4 ${
                        line.verdict === 'TRUE'
                          ? darkMode ? 'bg-green-900/20 border-green-600' : 'bg-green-50 border-green-500'
                          : line.verdict === 'FALSE'
                          ? darkMode ? 'bg-red-900/20 border-red-600' : 'bg-red-50 border-red-500'
                          : darkMode ? 'bg-yellow-900/20 border-yellow-600' : 'bg-yellow-50 border-yellow-500'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <p className={`flex-1 ${darkMode ? 'text-gray-200' : 'text-gray-800'} text-sm`}>
                          "{line.text}"
                        </p>
                        <span className={`ml-2 px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                          line.verdict === 'TRUE' ? 'bg-green-600 text-white' :
                          line.verdict === 'FALSE' ? 'bg-red-600 text-white' :
                          'bg-yellow-600 text-white'
                        }`}>
                          {line.verdict} ({line.confidence}%)
                        </span>
                      </div>
                      {line.explanation && (
                        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-2`}>
                          {line.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Original Verdict Display */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className={`${getVerdictColor(result.verdict)} border-l-4 rounded-lg shadow-lg p-6`}>
                <div className="flex items-center mb-4">
                  {getVerdictIcon(result.verdict)}
                  <div className="ml-4">
                    <h3 className="text-2xl font-bold">{result.verdict.replace(/_/g, ' ')}</h3>
                    <p className="text-sm opacity-80">Confidence: {getConfidenceLabel(result.confidence)} ({result.confidence}%)</p>
                  </div>
                </div>
                
                <div className="w-full bg-white bg-opacity-30 rounded-full h-3">
                  <div className="h-3 rounded-full bg-current transition-all duration-1000" style={{ width: `${result.confidence}%` }}></div>
                </div>

                <div className="mt-4 pt-4 border-t border-current border-opacity-20">
                  <div className="flex items-center text-sm opacity-90">
                    <Database className="w-4 h-4 mr-2" />
                    <span>{result.metadata?.totalSources || 0} sources analyzed</span>
                  </div>
                  <div className="flex items-center text-sm opacity-90 mt-1">
                    <Clock className="w-4 h-4 mr-2" />
                    <span>{(result.metadata?.processingTime / 1000).toFixed(2)}s processing</span>
                  </div>
                </div>
              </div>

              <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'} rounded-lg shadow-lg p-6 ${darkMode ? 'border' : ''}`}>
                <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'} mb-4 flex items-center`}>
                  <TrendingUp className={`w-6 h-6 mr-2 ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
                  Confidence Distribution
                </h3>
                
                {result.percentages && (getRingChartData().length > 0) ? (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={getRingChartData()} cx="50%" cy="50%" labelLine={false} label={CustomLabel} outerRadius={90} innerRadius={55} fill="#8884d8" dataKey="value" animationDuration={1000}>
                          {getRingChartData().map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                        </Pie>
                        <Tooltip formatter={(value) => `${value}%`} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                    
                    <div className={`mt-4 p-3 ${darkMode ? 'bg-blue-900' : 'bg-blue-50'} rounded-lg text-xs`}>
                      <p className={`font-semibold ${darkMode ? 'text-blue-200' : 'text-blue-900'} mb-2`}>Why these percentages?</p>
                      {result.verdict === 'TRUE' && (
                        <p className={darkMode ? 'text-blue-100' : 'text-blue-800'}>
                          <span className="font-semibold text-green-600">{result.percentages.true}% True:</span> LLaMA's confidence in the claim being true based on evidence analysis.
                          <br />
                          <span className="font-semibold text-yellow-600">{result.percentages.uncertain}% Uncertain:</span> Remaining probability of ambiguity or conflicting evidence.
                          <br />
                          <span className="font-semibold text-red-600">{result.percentages.false}% False:</span> Small chance the claim could be false despite evidence.
                        </p>
                      )}
                      {result.verdict === 'FALSE' && (
                        <p className={darkMode ? 'text-blue-100' : 'text-blue-800'}>
                          <span className="font-semibold text-red-600">{result.percentages.false}% False:</span> LLaMA's confidence in the claim being false based on evidence analysis.
                          <br />
                          <span className="font-semibold text-yellow-600">{result.percentages.uncertain}% Uncertain:</span> Remaining probability of ambiguity or conflicting evidence.
                          <br />
                          <span className="font-semibold text-green-600">{result.percentages.true}% True:</span> Small chance the claim could be true despite evidence.
                        </p>
                      )}
                      {result.verdict === 'UNCERTAIN' && (
                        <p className={darkMode ? 'text-blue-100' : 'text-blue-800'}>
                          <span className="font-semibold text-yellow-600">{result.percentages.uncertain}% Uncertain:</span> Evidence is inconclusive or conflicting.
                          <br />
                          <span className="font-semibold text-green-600">{result.percentages.true}% True:</span> Possibility the claim is true based on some supporting evidence.
                          <br />
                          <span className="font-semibold text-red-600">{result.percentages.false}% False:</span> Possibility the claim is false based on contradicting evidence.
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-gray-600">
                    <AlertCircle className="w-12 h-12 mb-3 text-gray-400" />
                    <p className="font-medium">Confidence distribution unavailable</p>
                    <p className="text-sm mt-2">Verdict: {result.verdict} ({result.confidence}%)</p>
                  </div>
                )}
              </div>
            </div>

            <div ref={summaryRef} className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'} rounded-lg shadow-lg p-6 ${darkMode ? 'border' : ''}`}>
              <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'} mb-4 flex items-center`}>
                <Info className={`w-6 h-6 mr-2 ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
                Why This Verdict?
              </h3>
              
              <div className="mb-6">
                <h4 className={`font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'} mb-2 flex items-center`}>
                  <span className={`w-2 h-2 ${darkMode ? 'bg-indigo-400' : 'bg-indigo-600'} rounded-full mr-2`}></span>
                  Summary
                </h4>
                <p className={`${darkMode ? 'text-gray-300 border-indigo-500' : 'text-gray-700 border-indigo-200'} leading-relaxed pl-4 border-l-4`}>
                  <TypingText text={result.summary || 'No summary available.'} speed={15} />
                </p>
              </div>

              <div>
                <h4 className={`font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'} mb-2 flex items-center`}>
                  <span className={`w-2 h-2 ${darkMode ? 'bg-indigo-400' : 'bg-indigo-600'} rounded-full mr-2`}></span>
                  Detailed Explanation
                </h4>
                <p className={`${darkMode ? 'text-gray-300 border-indigo-500' : 'text-gray-700 border-indigo-200'} leading-relaxed pl-4 border-l-4`}>
                  <TypingText text={result.explanation || 'No explanation available.'} speed={15} />
                </p>
              </div>

              <div className={`mt-6 p-4 ${darkMode ? 'bg-gradient-to-r from-indigo-900 to-indigo-800 border-indigo-700' : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-indigo-100'} rounded-lg border`}>
                <h4 className={`font-semibold ${darkMode ? 'text-indigo-200' : 'text-indigo-900'} mb-2 flex items-center`}>
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Why {result.confidence}% Confidence?
                </h4>
                <p className={`text-sm ${darkMode ? 'text-indigo-100' : 'text-indigo-800'}`}>
                  {result.verdict === 'TRUE' && (<>LLaMA analyzed {result.metadata?.totalSources || 0} sources and found <strong>strong evidence supporting</strong> the claim. The {result.confidence}% confidence reflects the consistency and reliability of evidence across fact-checks, encyclopedias, news articles, and other authoritative sources.</>)}
                  {result.verdict === 'FALSE' && (<>LLaMA analyzed {result.metadata?.totalSources || 0} sources and found <strong>strong evidence contradicting</strong> the claim. The {result.confidence}% confidence reflects how clearly the evidence debunks the claim across multiple fact-checking organizations and reliable sources.</>)}
                  {result.verdict === 'UNCERTAIN' && (<>LLaMA analyzed {result.metadata?.totalSources || 0} sources but found <strong>conflicting or insufficient evidence</strong>. The {result.confidence}% confidence in uncertainty reflects the lack of clear consensus or contradictory information across different sources. More investigation may be needed.</>)}
                </p>
              </div>
            </div>

            {result.sources && result.sources.length > 0 && (
              <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'} rounded-lg shadow-lg p-6 ${darkMode ? 'border' : ''}`}>
                <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'} mb-4`}>Sources Consulted ({result.sources.length})</h3>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-4`}>
                  The following sources were analyzed by LLaMA 3.1 to generate the final verdict. Click on any source to read the full article for deeper insights.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.sources.map((source, idx) => (
                    <div key={idx} className={`p-4 ${darkMode ? 'bg-gray-700 border-gray-600 hover:bg-gray-650' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'} rounded-lg transition-colors border`}>
                      <div className="flex items-start">
                        <div className="flex-shrink-0 mr-3">{getSourceIcon(source.type)}</div>
                        <div className="flex-grow">
                          <h4 className={`font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'} text-sm mb-1`}>{source.name}</h4>
                          <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                            <span className={`${darkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200'} px-2 py-0.5 rounded`}>{source.type || 'unknown'}</span>
                          </div>
                          
                          {source.excerpt && (<p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-2 line-clamp-2`}>{source.excerpt}</p>)}
                          {source.url && (
                            <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-800 inline-flex items-center font-medium">
                              Read Full Source <ExternalLink className="w-3 h-3 ml-1" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={`${darkMode ? 'bg-blue-900 border-blue-700' : 'bg-blue-50 border-blue-400'} border-l-4 p-4 rounded`}>
              <div className="flex">
                <Info className={`w-5 h-5 ${darkMode ? 'text-blue-400' : 'text-blue-600'} mr-3 flex-shrink-0 mt-0.5`} />
                <div>
                  <p className={`text-sm ${darkMode ? 'text-blue-200' : 'text-blue-800'} font-medium`}>Important Disclaimer</p>
                  <p className={`text-sm ${darkMode ? 'text-blue-300' : 'text-blue-700'} mt-1`}>
                    This system uses AI and multiple authoritative sources for verification. While comprehensive, no automated system is 100% accurate. Always cross-verify critical claims with expert sources.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {!result && !loading && (
          <div ref={howItWorksRef} className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'} rounded-lg shadow-lg p-6 ${darkMode ? 'border' : ''}`}>
            <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'} mb-4`}>How It Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className={`flex-shrink-0 w-8 h-8 ${darkMode ? 'bg-indigo-900 text-indigo-300' : 'bg-indigo-100 text-indigo-600'} rounded-full flex items-center justify-center font-bold mr-3`}>1</div>
                  <div>
                    <h4 className={`font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Multi-Source Evidence Gathering</h4>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Searches Google Fact Check, Wikipedia, News APIs, GDELT for relevant information</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className={`flex-shrink-0 w-8 h-8 ${darkMode ? 'bg-indigo-900 text-indigo-300' : 'bg-indigo-100 text-indigo-600'} rounded-full flex items-center justify-center font-bold mr-3`}>2</div>
                  <div>
                    <h4 className={`font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>ML Model Analysis</h4>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Runs fake news detection and NLI models (BART, DeBERTa, RoBERTa)</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className={`flex-shrink-0 w-8 h-8 ${darkMode ? 'bg-indigo-900 text-indigo-300' : 'bg-indigo-100 text-indigo-600'} rounded-full flex items-center justify-center font-bold mr-3`}>3</div>
                  <div>
                    <h4 className={`font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>LLaMA 3.1 Analysis</h4>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>AI reads all evidence and generates verdict with explanation</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className={`flex-shrink-0 w-8 h-8 ${darkMode ? 'bg-indigo-900 text-indigo-300' : 'bg-indigo-100 text-indigo-600'} rounded-full flex items-center justify-center font-bold mr-3`}>4</div>
                  <div>
                    <h4 className={`font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Comprehensive Report</h4>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Generates final verdict, confidence scores, and source citations</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FactCheckingSystem;