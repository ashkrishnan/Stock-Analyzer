'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface StockData {
  date: string;
  price: number;
  volume?: number;
}

interface ChartData extends StockData {
  ma20?: number | null;
  ma50?: number | null;
  ma200?: number | null;
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

  // Fetch real stock data using our API proxy
  const fetchStockData = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Call our API route instead of Yahoo Finance directly
      const response = await fetch(`/api/stock?symbol=${encodeURIComponent(symbol)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.chart?.result?.[0]) {
        throw new Error('Invalid symbol or no data available');
      }
      
      const result = data.chart.result[0];
      const timestamps = result.timestamp;
      const prices = result.indicators.quote[0];
      
      if (!timestamps || !prices.close) {
        throw new Error('No price data available for this symbol');
      }
      
      // Transform the data into our format
      const transformedData: StockData[] = timestamps.map((timestamp: number, index: number) => {
        const date = new Date(timestamp * 1000);
        return {
          date: date.toISOString().split('T')[0],
          price: parseFloat((prices.close[index] || 0).toFixed(2)),
          volume: prices.volume?.[index] || 0
        };
      }).filter((item: StockData) => item.price > 0); // Filter out invalid prices
      
      if (transformedData.length === 0) {
        throw new Error('No valid price data found for this symbol');
      }
      
      setStockData(transformedData);
    } catch (err) {
      console.error('Error fetching stock data:', err);
      if (err instanceof Error) {
        if (err.message.includes('Invalid symbol')) {
          setError(`"${symbol}" is not a valid stock symbol. Please try a different symbol like AAPL, MSFT, or GOOGL.`);
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

      const combinedData: ChartData[] = stockData.map((item, index) => ({
        ...item,
        ma20: ma20[index],
        ma50: ma50[index],
        ma200: ma200[index]
      }));

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
          <p className="text-sm text-gray-500 mt-1">Live data from Yahoo Finance</p>
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
                placeholder="Enter stock symbol (e.g., AAPL, MSFT, GOOGL)"
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
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip 
                    formatter={formatTooltipValue}
                    labelFormatter={(date) => new Date(date).toLocaleDateString()}
                  />
                  <Legend />
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