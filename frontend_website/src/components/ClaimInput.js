import React from 'react';
import { Shield } from 'lucide-react';

const ClaimInput = ({ claim, setClaim, onVerify, loading, darkMode }) => {
  return (
    <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'} rounded-xl shadow-lg p-6 mb-6 ${darkMode ? 'border' : ''}`}>
      <h2 className={`text-2xl font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
        Submit Claim for Verification
      </h2>
      
      <div className="mb-4">
        <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
          Enter Claim to Verify
        </label>
        <textarea
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          placeholder="Enter a factual claim (e.g., 'The Earth orbits the Sun' or 'Coffee helps reduce the risk of diabetes')"
          className={`w-full h-32 p-3 border ${
            darkMode 
              ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
              : 'border-gray-300 text-gray-900'
          } rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none`}
        />
      </div>

      <button
        onClick={onVerify}
        disabled={!claim.trim() || loading}
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
  );
};

export default ClaimInput;