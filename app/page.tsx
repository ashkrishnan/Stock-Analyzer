'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts';
import { TrendingUp, TrendingDown, Activity, BarChart3, AlertCircle, RefreshCw, Wifi, WifiOff, Download } from 'lucide-react';

export default function StockAnalyzer() {
  const [selectedStock, setSelectedStock] = useState('NVDA');
  const [timeframe, setTimeframe] = useState('6mo');
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Display options
  const [showMA9, setShowMA9] = useState(true);
  const [showMA50, setShowMA50] = useState(true);
  const [showMA200, setShowMA200] = useState(true);
  const [showSwingPoints, setShowSwingPoints] = useState(true);
  const [showSupportResistance, setShowSupportResistance] = useState(true);
  const [showTrendLines, setShowTrendLines] = useState(true);

  // Stock data state
  const [stockData, setStockData] = useState<any[]>([]);
  const [stockMeta, setStockMeta] = useState<any>({});

  // Calculate moving average
  const calculateMA = (data: number[], period: number): (number | null)[] => {
const result: (number | null)[] = [];    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else {
        const sum = data.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0);
        result.push(sum / period);
      }
    }
    return result;
  };

  // Fetch live data from Yahoo Finance
  const fetchLiveStockData = async (symbol: string, range = '6mo') => {
    setLoading(true);
    setError(null);
    
    try {
      // Yahoo Finance API endpoint (CORS proxy needed for browser)
      const proxyUrl = 'https://api.allorigins.win/raw?url=';
      const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=1d`;
      const url = proxyUrl + encodeURIComponent(yahooUrl);
      
      console.log('Fetching data for:', symbol, 'Range:', range);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
        throw new Error('No data received from Yahoo Finance');
      }
      
      const result = data.chart.result[0];
      const meta = result.meta;
      const timestamps = result.timestamp;
      const quotes = result.indicators.quote[0];
      
      // Process the data
      const prices = quotes.close.filter((price: number) => price !== null);
      const volumes = quotes.volume.filter((vol: number) => vol !== null);
      const highs = quotes.high.filter((high: number) => high !== null);
      const lows = quotes.low.filter((low: number) => low !== null);
      
      // Calculate moving averages
      const ma9 = calculateMA(prices, 9);
      const ma50 = calculateMA(prices, 50);
      const ma200 = calculateMA(prices, 200);
      
      // Format data for chart
      const chartData = timestamps.map((timestamp: number, index: number) => {
        if (quotes.close[index] === null) return null;
        
        const date = new Date(timestamp * 1000);
        return {
          date: date.toISOString().split('T')[0],
          price: Math.round(quotes.close[index] * 100) / 100,
          high: quotes.high[index],
          low: quotes.low[index],
          volume: quotes.volume[index],
          ma9: ma9[index] ? Math.round(ma9[index] * 100) / 100 : null,
          ma50: ma50[index] ? Math.round(ma50[index] * 100) / 100 : null,
          ma200: ma200[index] ? Math.round(ma200[index] * 100) / 100 : null,
          index: index
        };
      }).filter((item: any) => item !== null);
      
      // Current values (last available data)
      const currentPrice = prices[prices.length - 1];
      const currentMA9 = ma9[ma9.length - 1];
      const currentMA50 = ma50[ma50.length - 1];
      const currentMA200 = ma200[ma200.length - 1];
      
      // 52-week high/low (approximate from available data)
      const high52w = Math.max(...highs);
      const low52w = Math.min(...lows);
      
      const metaData = {
        symbol: meta.symbol,
        current: currentPrice,
        ma9: currentMA9,
        ma50: currentMA50,
        ma200: currentMA200,
        high52w: high52w,
        low52w: low52w,
        currency: meta.currency,
        regularMarketPrice: meta.regularMarketPrice,
        chartPreviousClose: meta.chartPreviousClose
      };
      
      console.log('Data processed successfully:', metaData);
      
      setStockData(chartData);
      setStockMeta(metaData);
      setLastUpdate(new Date());
      setIsConnected(true);
      
      return { data: chartData, meta: metaData };
      
    } catch (err: any) {
      console.error('API Error:', err);
      setError(err.message);
      setIsConnected(false);
      
      // Fallback to demo data if API fails
      console.log('Falling back to demo data');
      const demoData = generateDemoData(symbol, range);
      setStockData(demoData.data);
      setStockMeta(demoData.meta);
      
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Fallback demo data generator
  const generateDemoData = (symbol: string, range: string) => {
    const ranges: any = {
      'NVDA': { current: 182.70, ma9: 178.61, ma50: 161.46, ma200: 135.87, low52w: 86.62, high52w: 183.88 },
      'ANET': { current: 139.18, ma9: 137.50, ma50: 135.20, ma200: 128.90, low52w: 95.00, high52w: 148.50 },
      'AVGO': { current: 304.97, ma9: 302.10, ma50: 298.50, ma200: 285.40, low52w: 210.45, high52w: 310.34 },
      'MSTR': { current: 395.13, ma9: 392.80, ma50: 388.20, ma200: 375.60, low52w: 280.00, high52w: 450.00 },
      'DELL': { current: 137.61, ma9: 135.80, ma50: 132.40, ma200: 128.90, low52w: 66.25, high52w: 147.66 },
      'META': { current: 769.30, ma9: 765.20, ma50: 758.40, ma200: 720.80, low52w: 479.80, high52w: 784.75 },
      'TQQQ': { current: 92.16, ma9: 90.85, ma50: 88.20, ma200: 82.30, low52w: 35.00, high52w: 93.79 }
    };
    
    const stockInfo = ranges[symbol] || ranges['NVDA'];
    const days = range === '3mo' ? 90 : range === '6mo' ? 180 : 365;
    const data = [];
    
    let price = stockInfo.low52w + (stockInfo.high52w - stockInfo.low52w) * 0.2;
    const priceIncrement = (stockInfo.current - price) / days;
    
    for (let i = 0; i <= days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - i));
      
      price = (price + priceIncrement + (Math.random() - 0.5) * price * 0.02);
      price = Math.max(stockInfo.low52w * 0.95, Math.min(stockInfo.high52w * 1.02, price));
      
      if (i === days) price = stockInfo.current;
      
      data.push({
        date: date.toISOString().split('T')[0],
        price: Math.round(price * 100) / 100,
        ma9: i === days ? stockInfo.ma9 : price * (0.99 + Math.random() * 0.02),
        ma50: i === days ? stockInfo.ma50 : price * (0.95 + Math.random() * 0.08),
        ma200: i === days ? stockInfo.ma200 : price * (0.90 + Math.random() * 0.15),
        volume: Math.floor(Math.random() * 50000000) + 10000000,
        index: i
      });
    }
    
    return { data, meta: stockInfo };
  };

  // Load data when stock or timeframe changes
  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchLiveStockData(selectedStock, timeframe);
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
    
    loadData();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [selectedStock, timeframe]);

  useEffect(() => {
    setLastUpdate(new Date());
  }, []);

  // Technical Analysis Functions
  const findSwingPoints = (data: any[], window = 8) => {
    const highs: any[] = [];
    const lows: any[] = [];
    
    for (let i = window; i < data.length - window; i++) {
      const current = data[i].price;
      const leftPrices = data.slice(i - window, i).map(d => d.price);
      const rightPrices = data.slice(i + 1, i + window + 1).map(d => d.price);
      
      if (leftPrices.every(p => p <= current) && rightPrices.every(p => p <= current)) {
        highs.push({ ...data[i], type: 'high' });
      }
      if (leftPrices.every(p => p >= current) && rightPrices.every(p => p >= current)) {
        lows.push({ ...data[i], type: 'low' });
      }
    }
    
    return { highs: highs.slice(-6), lows: lows.slice(-6) };
  };

  const findSupportResistance = (data: any[]) => {
    if (!data.length) return [];
    
    const currentPrice = data[data.length - 1].price;
    const recentData = data.slice(-60);
    const prices = recentData.map(d => d.price);
    const recentHigh = Math.max(...prices);
    const recentLow = Math.min(...prices);
    
    const levels: any[] = [];
    
    if (recentHigh > currentPrice * 1.01) {
      levels.push({ price: recentHigh, type: 'resistance', label: 'Recent High' });
    }
    if (recentLow < currentPrice * 0.99) {
      levels.push({ price: recentLow, type: 'support', label: 'Recent Low' });
    }
    
    // Add MA levels as support/resistance
    const currentMA50 = stockMeta.ma50;
    const currentMA200 = stockMeta.ma200;
    
    if (currentMA50 && Math.abs(currentMA50 - currentPrice) / currentPrice < 0.05) {
      levels.push({ 
        price: currentMA50, 
        type: currentMA50 > currentPrice ? 'resistance' : 'support',
        label: '50-day MA'
      });
    }
    
    if (currentMA200 && Math.abs(currentMA200 - currentPrice) / currentPrice < 0.1) {
      levels.push({ 
        price: currentMA200, 
        type: currentMA200 > currentPrice ? 'resistance' : 'support',
        label: '200-day MA'
      });
    }
    
    return levels;
  };

  const calculateTrendLines = (swingPoints: any) => {
    const { highs, lows } = swingPoints;
    const trendLines: any[] = [];
    
    // Uptrend from lows
    if (lows.length >= 2) {
      const recentLows = lows.slice(-3);
      if (recentLows.length >= 2) {
        const first = recentLows[0];
        const last = recentLows[recentLows.length - 1];
        const slope = (last.price - first.price) / (last.index - first.index);
        
        if (slope > 0) {
          trendLines.push({
            type: 'support',
            slope,
            intercept: first.price - slope * first.index,
            startIndex: first.index,
            endIndex: stockData.length - 1
          });
        }
      }
    }
    
    // Downtrend from highs  
    if (highs.length >= 2) {
      const recentHighs = highs.slice(-3);
      if (recentHighs.length >= 2) {
        const first = recentHighs[0];
        const last = recentHighs[recentHighs.length - 1];
        const slope = (last.price - first.price) / (last.index - first.index);
        
        if (slope < 0) {
          trendLines.push({
            type: 'resistance',
            slope,
            intercept: first.price - slope * first.index,
            startIndex: first.index,
            endIndex: stockData.length - 1
          });
        }
      }
    }
    
    return trendLines;
  };

  const swingPoints = useMemo(() => findSwingPoints(stockData), [stockData]);
  const supportResistanceLevels = useMemo(() => findSupportResistance(stockData), [stockData, stockMeta]);
  const trendLines = useMemo(() => calculateTrendLines(swingPoints), [swingPoints, stockData]);

  const stocks = ['NVDA', 'ANET', 'AVGO', 'MSTR', 'DELL', 'META', 'TQQQ'];
  const currentPrice = stockMeta.current || 0;
  const previousPrice = stockData.length > 1 ? stockData[stockData.length - 2]?.price : stockMeta.chartPreviousClose;
  const priceChange = previousPrice ? currentPrice - previousPrice : 0;
  const priceChangePercent = previousPrice ? (priceChange / previousPrice) * 100 : 0;

  // Manual refresh function
  const handleRefresh = async () => {
    try {
      await fetchLiveStockData(selectedStock, timeframe);
    } catch (error) {
      console.error('Manual refresh failed:', error);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* Header with Connection Status */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div className="mb-4 md:mb-0">
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <BarChart3 className="h-8 w-8 text-blue-600" />
              Live Stock Technical Analyzer
            </h1>
            <p className="text-gray-600 mt-1">Real-time Yahoo Finance data with professional technical analysis</p>
            
            {/* Connection Status */}
            <div className="flex items-center gap-4 mt-2">
              <div className={`flex items-center gap-2 text-sm px-3 py-1 rounded-lg ${isConnected ? 'text-green-600 bg-green-50 border border-green-200' : 'text-red-600 bg-red-50 border border-red-200'}`}>
                {isConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                <span>{isConnected ? 'Yahoo Finance Connected' : 'Using Demo Data'}</span>
              </div>
              <div className="text-xs text-gray-500">
                Last Update: {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Loading...'}
              </div>
              {error && (
                <div className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded">
                  {error}
                </div>
              )}
            </div>
          </div>
          
          {/* Real-time Price Display */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg p-4 border border-blue-200 min-w-[280px]">
            <div className="flex justify-between items-start mb-2">
              <div className="text-2xl font-bold text-gray-800">{selectedStock}</div>
              <button 
                onClick={handleRefresh}
                disabled={loading}
                className={`p-1 rounded ${loading ? 'text-gray-400' : 'text-blue-600 hover:text-blue-800'}`}
                title="Refresh data"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="text-xl font-semibold text-blue-700">${currentPrice.toFixed(2)}</div>
            <div className={`text-sm flex items-center gap-1 ${priceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {priceChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)} ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
            </div>
            <div className="text-xs text-gray-600 mt-1">
              52W: ${stockMeta.low52w?.toFixed(2) || 'N/A'} - ${stockMeta.high52w?.toFixed(2) || 'N/A'}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
            <select 
              value={selectedStock} 
              onChange={(e) => setSelectedStock(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md bg-white text-sm"
            >
              {stocks.map(stock => (
                <option key={stock} value={stock}>{stock}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
            <select 
              value={timeframe} 
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md bg-white text-sm"
            >
              <option value="1mo">1M</option>
              <option value="3mo">3M</option>
              <option value="6mo">6M</option>
              <option value="1y">1Y</option>
              <option value="2y">2Y</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">9-day MA</label>
            <label className="flex items-center">
              <input type="checkbox" checked={showMA9} onChange={(e) => setShowMA9(e.target.checked)} className="mr-1" />
              <span className="text-xs">Show</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">50-day MA</label>
            <label className="flex items-center">
              <input type="checkbox" checked={showMA50} onChange={(e) => setShowMA50(e.target.checked)} className="mr-1" />
              <span className="text-xs">Show</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">200-day MA</label>
            <label className="flex items-center">
              <input type="checkbox" checked={showMA200} onChange={(e) => setShowMA200(e.target.checked)} className="mr-1" />
              <span className="text-xs">Show</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Swings</label>
            <label className="flex items-center">
              <input type="checkbox" checked={showSwingPoints} onChange={(e) => setShowSwingPoints(e.target.checked)} className="mr-1" />
              <span className="text-xs">Show</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">S/R</label>
            <label className="flex items-center">
              <input type="checkbox" checked={showSupportResistance} onChange={(e) => setShowSupportResistance(e.target.checked)} className="mr-1" />
              <span className="text-xs">Show</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trends</label>
            <label className="flex items-center">
              <input type="checkbox" checked={showTrendLines} onChange={(e) => setShowTrendLines(e.target.checked)} className="mr-1" />
              <span className="text-xs">Show</span>
            </label>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white border rounded-lg p-4 mb-6 relative" style={{ height: '500px' }}>
          {loading && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
              <div className="flex items-center gap-2 text-blue-600">
                <RefreshCw className="h-5 w-5 animate-spin" />
                <span>Loading Yahoo Finance data...</span>
              </div>
            </div>
          )}
          
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stockData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11 }}
                tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis 
                domain={['dataMin - 2', 'dataMax + 2']}
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => `$${value.toFixed(0)}`}
              />
              <Tooltip 
                formatter={(value, name) => {
                  const labels: any = {
                    'price': 'Price',
                    'ma9': '9-day MA',
                    'ma50': '50-day MA', 
                    'ma200': '200-day MA'
                  };
                  return [`$${value?.toFixed(2) || 'N/A'}`, labels[name] || name];
                }}
                labelFormatter={(date) => new Date(date).toLocaleDateString()}
              />
              
              {/* Price line */}
              <Line 
                type="monotone" 
                dataKey="price" 
                stroke="#1f2937" 
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5, stroke: '#1f2937', strokeWidth: 2 }}
                connectNulls={false}
              />

              {/* Moving Averages */}
              {showMA9 && (
                <Line 
                  type="monotone" 
                  dataKey="ma9" 
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="4 2"
                  connectNulls={false}
                />
              )}
              
              {showMA50 && (
                <Line 
                  type="monotone" 
                  dataKey="ma50" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
              )}
              
              {showMA200 && (
                <Line 
                  type="monotone" 
                  dataKey="ma200" 
                  stroke="#dc2626" 
                  strokeWidth={3}
                  dot={false}
                  connectNulls={false}
                />
              )}

              {/* Support/Resistance Lines */}
              {showSupportResistance && supportResistanceLevels.map((level: any, index: number) => (
                <ReferenceLine
                  key={`sr-${index}`}
                  y={level.price}
                  stroke={level.type === 'support' ? '#10b981' : '#ef4444'}
                  strokeDasharray="6 4"
                  strokeWidth={2}
                  label={{ 
                    value: `${level.label} $${level.price.toFixed(2)}`, 
                    position: 'topRight',
                    style: { 
                      fontSize: '11px', 
                      fill: level.type === 'support' ? '#10b981' : '#ef4444',
                      fontWeight: 'bold'
                    }
                  }}
                />
              ))}

              {/* Trend Lines */}
              {showTrendLines && trendLines.map((trendLine: any, index: number) => {
                const startPrice = trendLine.slope * trendLine.startIndex + trendLine.intercept;
                const endPrice = trendLine.slope * trendLine.endIndex + trendLine.intercept;
                
                return (
                  <ReferenceLine
                    key={`trend-${index}`}
                    segment={[
                      { x: stockData[trendLine.startIndex]?.date, y: startPrice },
                      { x: stockData[trendLine.endIndex]?.date, y: endPrice }
                    ]}
                    stroke={trendLine.type === 'support' ? '#059669' : '#dc2626'}
                    strokeWidth={3}
                    strokeDasharray="6 3"
                  />
                );
              })}

              {/* Swing Points */}
              {showSwingPoints && swingPoints.highs.map((point: any, index: number) => (
                <ReferenceDot
                  key={`high-${index}`}
                  x={point.date}
                  y={point.price}
                  r={5}
                  fill="#ef4444"
                  stroke="#dc2626"
                  strokeWidth={2}
                />
              ))}
              
              {showSwingPoints && swingPoints.lows.map((point: any, index: number) => (
                <ReferenceDot
                  key={`low-${index}`}
                  x={point.date}
                  y={point.price}
                  r={5}
                  fill="#10b981"
                  stroke="#059669"
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Live Data Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Current Data */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h3 className="font-semibold text-blue-800 mb-3">Real-Time Data</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Price:</span>
                <span className="font-bold">${currentPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>9-day MA:</span>
                <span className="font-medium">${stockMeta.ma9?.toFixed(2) || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>50-day MA:</span>
                <span className="font-medium">${stockMeta.ma50?.toFixed(2) || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>200-day MA:</span>
                <span className="font-medium">${stockMeta.ma200?.toFixed(2) || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Technical Signals */}
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <h3 className="font-semibold text-purple-800 mb-3">Technical Signals</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Trend:</span>
                <span className={`font-medium ${stockMeta.ma9 > stockMeta.ma50 && stockMeta.ma50 > stockMeta.ma200 ? 'text-green-600' : 'text-red-600'}`}>
                  {stockMeta.ma9 > stockMeta.ma50 && stockMeta.ma50 > stockMeta.ma200 ? 'Bullish' : 'Mixed/Bearish'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Swing Highs:</span>
                <span className="font-medium">{swingPoints.highs.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Swing Lows:</span>
                <span className="font-medium">{swingPoints.lows.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Key Levels:</span>
                <span className="font-medium">{supportResistanceLevels.length}</span>
              </div>
            </div>
          </div>

          {/* Performance */}
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <h3 className="font-semibold text-green-800 mb-3">Performance</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>52W High:</span>
                <span className="font-medium">${stockMeta.high52w?.toFixed(2) || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>52W Low:</span>
                <span className="font-medium">${stockMeta.low52w?.toFixed(2) || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>From High:</span>
                <span className="font-medium text-red-600">
                  {stockMeta.high52w ? `-${(((stockMeta.high52w - currentPrice) / stockMeta.high52w) * 100).toFixed(1)}%` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Range Position:</span>
                <span className="font-medium">
                  {stockMeta.high52w && stockMeta.low52w ? `${(((currentPrice - stockMeta.low52w) / (stockMeta.high52w - stockMeta.low52w)) * 100).toFixed(0)}%` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Data Source */}
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <h3 className="font-semibold text-yellow-800 mb-3">Data Source</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Provider:</span>
                <span className="font-medium text-xs">Yahoo Finance</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className={`font-medium ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                  {isConnected ? 'Live' : 'Demo'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Refresh:</span>
                <span className="font-medium text-xs">60s auto</span>
              </div>
              <div className="flex justify-between">
                <span>Delay:</span>
                <span className="font-medium text-xs">~15 min</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}