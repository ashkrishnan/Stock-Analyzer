'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Scatter, ReferenceLine } from 'recharts';

interface StockData {
  date: string;
  price: number;
  volume?: number;
}

interface ChartData extends StockData {
  ma20?: number | null;
  ma50?: number | null;
  ma200?: number | null;
  isSupport?: boolean;
  isResistance?: boolean;
  supportLevel?: number;
  resistanceLevel?: number;
}

interface SupportResistanceLevel {
  price: number;
  date: string;
  type: 'support' | 'resistance';
  strength: number;
}

const StockAnalyzer: React.FC = () => {
  const [symbol, setSymbol] = useState<string>('AAPL');
  const [stockData, setStockData] = useState<StockData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [showMA20, setShowMA20] = useState<boolean>(true);
  const [showMA50, setShowMA50] = useState<boolean>(true);
  const [showMA200, setShowMA200] = useState<boolean>(true);
  const [supportResistanceLevels, setSupportResistanceLevels] = useState<SupportResistanceLevel[]>([]);
  const [showSupportResistance, setShowSupportResistance] = useState<boolean>(true);

  // Calculate moving average
  const calculateMA = (data: number[], period: number): (number | null)[] => {
    const result: (number | null)[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else {
        const sum = data.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0);
        result.push(sum / period);
      }
    }
    return result;
  };

  // Detect swing highs (resistance) and swing lows (support) - improved algorithm
  const detectSupportResistance = (data: StockData[]): SupportResistanceLevel[] => {
    const levels: SupportResistanceLevel[] = [];
    const lookbackPeriod = 8; // Look at 8 days on each side (more sensitive)
    const currentPrice = data[data.length - 1].price;
    
    // Focus on recent data (last 6 months instead of full year)
    const recentDataStart = Math.max(0, data.length - 180); // Last 180 days
    const recentData = data.slice(recentDataStart);
    
    for (let i = lookbackPeriod; i < recentData.length - lookbackPeriod; i++) {
      const actualIndex = recentDataStart + i; // Actual index in full dataset
      const price = recentData[i].price;
      const leftPrices = recentData.slice(i - lookbackPeriod, i).map(d => d.price);
      const rightPrices = recentData.slice(i + 1, i + lookbackPeriod + 1).map(d => d.price);
      
      // Check for swing high (resistance) - must be above current price to be relevant
      const isSwingHigh = leftPrices.every(p => p <= price) && 
                         rightPrices.every(p => p <= price) &&
                         price > currentPrice * 0.98; // Only if within 2% above current price
      
      // Check for swing low (support) - must be below current price to be relevant  
      const isSwingLow = leftPrices.every(p => p >= price) && 
                        rightPrices.every(p => p >= price) &&
                        price < currentPrice * 1.02; // Only if within 2% below current price
      
      if (isSwingHigh || isSwingLow) {
        // Check if this level is far enough from existing levels
        const tooClose = levels.some(level => 
          Math.abs(level.price - price) < (currentPrice * 0.015) // Within 1.5% of current price
        );
        
        if (!tooClose) {
          // Calculate how recent this level is (more recent = higher strength)
          const recencyBonus = (i / recentData.length) * 5; // Up to 5 bonus points for recent levels
          
          levels.push({
            price: price,
            date: recentData[i].date,
            type: isSwingHigh ? 'resistance' : 'support',
            strength: calculateLevelStrength(data, actualIndex, price) + recencyBonus
          });
        }
      }
    }
    
    // Separate and filter levels
    const resistanceLevels = levels
      .filter(level => level.type === 'resistance' && level.price > currentPrice * 0.99)
      .sort((a, b) => a.price - b.price) // Sort resistance from lowest to highest
      .slice(0, 4);
      
    const supportLevels = levels
      .filter(level => level.type === 'support' && level.price < currentPrice * 1.01)
      .sort((a, b) => b.price - a.price) // Sort support from highest to lowest
      .slice(0, 4);
    
    return [...resistanceLevels, ...supportLevels]
      .sort((a, b) => b.strength - a.strength);
  };

  // Calculate the strength of a support/resistance level
  const calculateLevelStrength = (data: StockData[], index: number, price: number): number => {
    let strength = 1;
    const tolerance = price * 0.01; // 1% tolerance
    
    // Count how many times price touched this level
    for (let i = 0; i < data.length; i++) {
      if (i !== index && Math.abs(data[i].price - price) <= tolerance) {
        strength += 1;
      }
    }
    
    // Add strength based on volume at this level
    if (data[index].volume && data[index].volume! > 0) {
      const avgVolume = data.reduce((sum, d) => sum + (d.volume || 0), 0) / data.length;
      if (data[index].volume! > avgVolume * 1.5) {
        strength += 2;
      }
    }
    
    return strength;
  };

  // Fetch real stock data using Twelve Data API (free tier with better CORS support)
  const fetchStockData = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Twelve Data free API - better CORS support than Finnhub
      // Get your free API key at https://twelvedata.com
      const API_KEY = 'ac4cc9d968f841f6b45851db25b9e8ab'; // Replace with your free API key for better reliability
      
      // Get historical data (includes current price)
      const response = await fetch(
        `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=365&apikey=${API_KEY}&format=JSON`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Check for API errors
      if (data.status === 'error' || data.code) {
        throw new Error(data.message || 'Invalid symbol or API limit reached');
      }
      
      if (!data.values || data.values.length === 0) {
        throw new Error('No data available for this symbol');
      }
      
      // Transform data to our format
      const transformedData: StockData[] = data.values
        .reverse() // Twelve Data returns newest first, we want oldest first
        .map((item: any) => ({
          date: item.datetime,
          price: parseFloat(parseFloat(item.close).toFixed(2)),
          volume: parseInt(item.volume) || 0
        }));
      
      if (transformedData.length === 0) {
        throw new Error('No valid price data found for this symbol');
      }
      
      setStockData(transformedData);
      
    } catch (err) {
      console.error('Error fetching stock data:', err);
      if (err instanceof Error) {
        if (err.message.includes('Invalid symbol') || err.message.includes('not found')) {
          setError(`"${symbol}" is not a valid stock symbol. Please try a different symbol like AAPL, MSFT, or GOOGL.`);
        } else if (err.message.includes('API limit') || err.message.includes('limit')) {
          setError('API rate limit reached. Please wait a moment or get a free API key from twelvedata.com');
        } else if (err.message.includes('HTTP error')) {
          setError('Unable to fetch stock data. Please check your internet connection and try again.');
        } else {
          setError(`Error: ${err.message}`);
        }
      } else {
        setError('Failed to fetch stock data. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (stockData.length > 0) {
      const prices = stockData.map(item => item.price);
      const ma20 = calculateMA(prices, 20);
      const ma50 = calculateMA(prices, 50);
      const ma200 = calculateMA(prices, 200);

      // Detect support and resistance levels
      const srLevels = detectSupportResistance(stockData);
      setSupportResistanceLevels(srLevels);

      const combinedData: ChartData[] = stockData.map((item, index) => {
        // Check if this point is a support or resistance level
        const isSupport = srLevels.some(level => 
          level.date === item.date && level.type === 'support'
        );
        const isResistance = srLevels.some(level => 
          level.date === item.date && level.type === 'resistance'
        );

        return {
          ...item,
          ma20: ma20[index],
          ma50: ma50[index],
          ma200: ma200[index],
          isSupport,
          isResistance
        };
      });

      setChartData(combinedData);
    }
  }, [stockData]);

  useEffect(() => {
    fetchStockData();
  }, []);

  const handleSymbolSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fetchStockData();
  };

  const getCurrentPrice = (): number => {
    return stockData.length > 0 ? stockData[stockData.length - 1].price : 0;
  };

  const getPriceChange = (): { change: number; changePercent: number } => {
    if (stockData.length < 2) return { change: 0, changePercent: 0 };
    
    const current = stockData[stockData.length - 1].price;
    const previous = stockData[stockData.length - 2].price;
    const change = current - previous;
    const changePercent = (change / previous) * 100;
    
    return { change, changePercent };
  };

  const { change, changePercent } = getPriceChange();
  const currentPrice = getCurrentPrice();

  const formatTooltipValue = (value: any, name: string): [string, string] => {
    const labels: Record<string, string> = {
      'price': 'Price',
      'ma20': '20-day MA',
      'ma50': '50-day MA',
      'ma200': '200-day MA'
    };
    
    // Handle both number and string values
    const formattedValue = typeof value === 'number' ? value.toFixed(2) : (value || 'N/A');
    return [`$${formattedValue}`, labels[name] || name];
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Stock Analyzer</h1>
          <p className="text-lg text-gray-600">Analyze real-time stock prices with moving averages</p>
          <p className="text-sm text-gray-500 mt-1">Live data from Twelve Data API - Get your free API key at twelvedata.com</p>
        </div>

        {/* Stock Input Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <form onSubmit={handleSymbolSubmit} className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label htmlFor="symbol" className="block text-sm font-medium text-gray-700 mb-2">
                Stock Symbol
              </label>
              <input
                type="text"
                id="symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter stock symbol (e.g., AAPL, META, TSLA)"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : 'Analyze'}
            </button>
          </form>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-8">
            <div className="text-red-800">{error}</div>
          </div>
        )}

        {/* Price Summary */}
        {stockData.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{symbol}</h2>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-bold text-gray-900">
                    ${currentPrice.toFixed(2)}
                  </span>
                  <span className={`text-lg font-medium ${
                    change >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {change >= 0 ? '+' : ''}${change.toFixed(2)} ({changePercent.toFixed(2)}%)
                  </span>
                </div>
              </div>
              <div className="mt-4 sm:mt-0 text-right">
                <p className="text-sm text-gray-600">Last Updated</p>
                <p className="text-sm font-medium text-gray-900">
                  {stockData.length > 0 ? stockData[stockData.length - 1].date : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Chart Controls */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Chart Options</h3>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showMA20}
                  onChange={(e) => setShowMA20(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">20-day Moving Average</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showMA50}
                  onChange={(e) => setShowMA50(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">50-day Moving Average</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showMA200}
                  onChange={(e) => setShowMA200(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">200-day Moving Average</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showSupportResistance}
                  onChange={(e) => setShowSupportResistance(e.target.checked)}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="ml-2 text-sm text-gray-700">Support & Resistance Levels</span>
              </label>
            </div>
          </div>
        )}

        {/* Price Chart */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Price Chart</h3>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `${value}`}
                  />
                  <Tooltip 
                    formatter={formatTooltipValue}
                    labelFormatter={(date) => new Date(date).toLocaleDateString()}
                  />
                  <Legend />
                  
                  {/* Support and Resistance Reference Lines */}
                  {showSupportResistance && supportResistanceLevels.map((level, index) => (
                    <ReferenceLine 
                      key={`${level.type}-${index}`}
                      y={level.price} 
                      stroke={level.type === 'resistance' ? '#ef4444' : '#10b981'} 
                      strokeDasharray="3 3" 
                      strokeWidth={2}
                      label={{
                        value: `${level.type === 'resistance' ? 'R' : 'S'}: ${level.price.toFixed(2)}`,
                        position: 'insideTopRight',
                        style: { 
                          fontSize: '10px', 
                          fill: level.type === 'resistance' ? '#ef4444' : '#10b981',
                          fontWeight: 'bold'
                        }
                      }}
                    />
                  ))}
                  
                  <Line 
                    type="monotone" 
                    dataKey="price" 
                    stroke="#1f2937" 
                    strokeWidth={2}
                    name="Price"
                    dot={false}
                  />
                  
                  {showMA20 && (
                    <Line 
                      type="monotone" 
                      dataKey="ma20" 
                      stroke="#3b82f6" 
                      strokeWidth={1}
                      strokeDasharray="5 5"
                      name="20-day MA"
                      dot={false}
                      connectNulls={false}
                    />
                  )}
                  {showMA50 && (
                    <Line 
                      type="monotone" 
                      dataKey="ma50" 
                      stroke="#10b981" 
                      strokeWidth={1}
                      strokeDasharray="5 5"
                      name="50-day MA"
                      dot={false}
                      connectNulls={false}
                    />
                  )}
                  {showMA200 && (
                    <Line 
                      type="monotone" 
                      dataKey="ma200" 
                      stroke="#ef4444" 
                      strokeWidth={1}
                      strokeDasharray="5 5"
                      name="200-day MA"
                      dot={false}
                      connectNulls={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Support & Resistance Levels */}
        {supportResistanceLevels.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Support & Resistance Levels</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-md font-medium text-green-700 mb-3">Support Levels</h4>
                {supportResistanceLevels
                  .filter(level => level.type === 'support')
                  .sort((a, b) => b.price - a.price)
                  .slice(0, 4)
                  .map((level, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-600">
                        {new Date(level.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <span className="text-lg font-bold text-green-600">
                        ${level.price.toFixed(2)}
                      </span>
                      <span className="text-xs text-gray-500">
                        Strength: {level.strength}
                      </span>
                    </div>
                  ))}
              </div>
              <div>
                <h4 className="text-md font-medium text-red-700 mb-3">Resistance Levels</h4>
                {supportResistanceLevels
                  .filter(level => level.type === 'resistance')
                  .sort((a, b) => a.price - b.price)
                  .slice(0, 4)
                  .map((level, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-600">
                        {new Date(level.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <span className="text-lg font-bold text-red-600">
                        ${level.price.toFixed(2)}
                      </span>
                      <span className="text-xs text-gray-500">
                        Strength: {level.strength}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Technical Analysis Summary */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Technical Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  ${chartData[chartData.length - 1]?.ma20?.toFixed(2) || 'N/A'}
                </div>
                <div className="text-sm text-gray-600">20-Day Moving Average</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  ${chartData[chartData.length - 1]?.ma50?.toFixed(2) || 'N/A'}
                </div>
                <div className="text-sm text-gray-600">50-Day Moving Average</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  ${chartData[chartData.length - 1]?.ma200?.toFixed(2) || 'N/A'}
                </div>
                <div className="text-sm text-gray-600">200-Day Moving Average</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockAnalyzer;
