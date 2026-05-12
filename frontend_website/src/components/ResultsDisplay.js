import React, { useEffect, useState } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Info, 
  ExternalLink, 
  Clock, 
  Database,
  Shield,
  TrendingUp
} from 'lucide-react';

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

const ResultsDisplay = ({ result, darkMode, summaryRef }) => {
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
    <>
      {/* Verdict Card */}
      <div className={`${getVerdictColor(result.verdict)} border-l-4 rounded-lg shadow-lg p-6`}>
        <div className="flex items-center mb-4">
          {getVerdictIcon(result.verdict)}
          <div className="ml-4">
            <h3 className="text-2xl font-bold">
              {result.verdict.replace(/_/g, ' ')}
            </h3>
            <p className="text-sm opacity-80">
              Confidence: {getConfidenceLabel(result.confidence)} ({result.confidence}%)
            </p>
          </div>
        </div>
        
        <div className="w-full bg-white bg-opacity-30 rounded-full h-3">
          <div
            className="h-3 rounded-full bg-current transition-all duration-1000"
            style={{ width: `${result.confidence}%` }}
          ></div>
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

      {/* Summary and Explanation */}
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
            {result.verdict === 'TRUE' && (
              <>
                LLaMA analyzed {result.metadata?.totalSources || 0} sources and found <strong>strong evidence supporting</strong> the claim. 
                The {result.confidence}% confidence reflects the consistency and reliability of evidence across fact-checks, 
                encyclopedias, news articles, and other authoritative sources.
              </>
            )}
            {result.verdict === 'FALSE' && (
              <>
                LLaMA analyzed {result.metadata?.totalSources || 0} sources and found <strong>strong evidence contradicting</strong> the claim. 
                The {result.confidence}% confidence reflects how clearly the evidence debunks the claim across multiple 
                fact-checking organizations and reliable sources.
              </>
            )}
            {result.verdict === 'UNCERTAIN' && (
              <>
                LLaMA analyzed {result.metadata?.totalSources || 0} sources but found <strong>conflicting or insufficient evidence</strong>. 
                The {result.confidence}% confidence in uncertainty reflects the lack of clear consensus or contradictory 
                information across different sources. More investigation may be needed.
              </>
            )}
          </p>
        </div>
      </div>

      {/* Sources */}
      {result.sources && result.sources.length > 0 && (
        <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'} rounded-lg shadow-lg p-6 ${darkMode ? 'border' : ''}`}>
          <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'} mb-4`}>
            Sources Consulted ({result.sources.length})
          </h3>
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-4`}>
            The following sources were analyzed by LLaMA 3.1 to generate the final verdict. Click on any source to read the full article for deeper insights.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.sources.map((source, idx) => (
              <div key={idx} className={`p-4 ${darkMode ? 'bg-gray-700 border-gray-600 hover:bg-gray-650' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'} rounded-lg transition-colors border`}>
                <div className="flex items-start">
                  <div className="flex-shrink-0 mr-3">
                    {getSourceIcon(source.type)}
                  </div>
                  <div className="flex-grow">
                    <h4 className={`font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'} text-sm mb-1`}>
                      {source.name}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                      <span className={`${darkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200'} px-2 py-0.5 rounded`}>
                        {source.type || 'unknown'}
                      </span>
                    </div>
                    
                    {source.excerpt && (
                      <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-2 line-clamp-2`}>
                        {source.excerpt}
                      </p>
                    )}
                    {source.url && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-600 hover:text-indigo-800 inline-flex items-center font-medium"
                      >
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

      {/* Disclaimer */}
      <div className={`${darkMode ? 'bg-blue-900 border-blue-700' : 'bg-blue-50 border-blue-400'} border-l-4 p-4 rounded`}>
        <div className="flex">
          <Info className={`w-5 h-5 ${darkMode ? 'text-blue-400' : 'text-blue-600'} mr-3 flex-shrink-0 mt-0.5`} />
          <div>
            <p className={`text-sm ${darkMode ? 'text-blue-200' : 'text-blue-800'} font-medium`}>
              Important Disclaimer
            </p>
            <p className={`text-sm ${darkMode ? 'text-blue-300' : 'text-blue-700'} mt-1`}>
              This system uses AI and multiple authoritative sources for verification. While comprehensive, 
              no automated system is 100% accurate. Always cross-verify critical claims with expert sources.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default ResultsDisplay;