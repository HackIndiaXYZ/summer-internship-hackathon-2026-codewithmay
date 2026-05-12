import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { TrendingUp, AlertCircle } from 'lucide-react';

const ConfidenceChart = ({ result, darkMode }) => {
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
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="font-bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'} rounded-lg shadow-lg p-6 ${darkMode ? 'border' : ''}`}>
      <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'} mb-4 flex items-center`}>
        <TrendingUp className={`w-6 h-6 mr-2 ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
        Confidence Distribution
      </h3>
      
      {result.percentages && (getRingChartData().length > 0) ? (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={getRingChartData()}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={CustomLabel}
                outerRadius={90}
                innerRadius={55}
                fill="#8884d8"
                dataKey="value"
                animationDuration={1000}
              >
                {getRingChartData().map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value}%`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
          
          <div className={`mt-4 p-3 ${darkMode ? 'bg-blue-900' : 'bg-blue-50'} rounded-lg text-xs`}>
            <p className={`font-semibold ${darkMode ? 'text-blue-200' : 'text-blue-900'} mb-2`}>
              Why these percentages?
            </p>
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
  );
};

export default ConfidenceChart;