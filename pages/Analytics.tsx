
import React, { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { db } from '../services/databaseService';
import { OrderStatus } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

// Holt-Winters Multiplicative Algorithm (Robust)
const holtWintersForecast = (data: number[], seasonLength: number, alpha: number = 0.2, beta: number = 0.1, gamma: number = 0.1, forecastLength: number) => {
  // Requires at least 2 full seasons to initialize and smooth
  if (data.length < seasonLength * 2) return [];

  const L = new Array(data.length).fill(0);
  const T = new Array(data.length).fill(0);
  const S = new Array(data.length).fill(0);

  // 1. Initialize Seasonality
  let seasonalAvg = 0;
  for (let i = 0; i < seasonLength; i++) {
    seasonalAvg += data[i];
  }
  seasonalAvg /= seasonLength;

  for (let i = 0; i < seasonLength; i++) {
    // Prevent division by zero if seasonal average is 0
    S[i] = seasonalAvg === 0 ? 1 : data[i] / seasonalAvg;
  }

  // 2. Initialize Level and Trend
  // Level: Initial approximate level
  L[seasonLength - 1] = data[seasonLength - 1] === 0 ? 0.1 : data[seasonLength - 1]; 
  
  // Trend: Average slope over the first season
  let trendSum = 0;
  for (let i = 0; i < seasonLength; i++) {
      trendSum += (data[seasonLength + i] - data[i]) / seasonLength;
  }
  T[seasonLength - 1] = trendSum / seasonLength;

  // 3. Triple Exponential Smoothing
  for (let i = seasonLength; i < data.length; i++) {
    const val = data[i];
    const prevL = L[i - 1];
    const prevT = T[i - 1];
    const prevS = S[i - seasonLength];
    
    const safePrevS = prevS < 0.001 ? 0.001 : prevS; // Avoid div by zero

    L[i] = alpha * (val / safePrevS) + (1 - alpha) * (prevL + prevT);
    T[i] = beta * (L[i] - prevL) + (1 - beta) * prevT;
    
    const safeL = L[i] < 0.001 ? 0.001 : L[i]; // Avoid div by zero
    S[i] = gamma * (val / safeL) + (1 - gamma) * prevS;
  }

  // 4. Generate Forecasts
  const forecasts = [];
  const lastL = L[data.length - 1];
  const lastT = T[data.length - 1];

  for (let m = 1; m <= forecastLength; m++) {
    // Cyclical seasonality index from the last computed season
    const sIdx = data.length - seasonLength + ((m - 1) % seasonLength);
    const seasonalComponent = S[sIdx];
    
    const forecastVal = (lastL + m * lastT) * seasonalComponent;
    forecasts.push(Math.max(0, forecastVal));
  }

  return forecasts;
};

interface PredictionItem {
  name: string;
  growth: string;
  badge: string;
  isPositive: boolean;
}

// Helpers for Date Manipulation
const getStartOfDay = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 is Sunday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
  d.setDate(diff);
  return d;
};

const getStartOfMonth = (date: Date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), 1);
    d.setHours(0, 0, 0, 0);
    return d;
};

const Analytics: React.FC = () => {
  const { t } = useLanguage();
  
  // Real Data State
  const [growthPercentage, setGrowthPercentage] = useState(0);
  const [growthTrend, setGrowthTrend] = useState<{name: string, val: number}[]>([]);
  const [isGrowthPositive, setIsGrowthPositive] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  
  // Forecasting State
  const [forecastChartData, setForecastChartData] = useState<any[]>([]);
  const [forecastMessage, setForecastMessage] = useState('');
  const [hasSufficientData, setHasSufficientData] = useState(false);
  const [timeResolution, setTimeResolution] = useState<'Day' | 'Week' | 'Month'>('Month');

  // Custom File Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customChartData, setCustomChartData] = useState<any[]>([]);
  const [customFileName, setCustomFileName] = useState('');
  const [customError, setCustomError] = useState('');
  const [customResolution, setCustomResolution] = useState('Auto');

  // Prediction State
  const [predictions, setPredictions] = useState<PredictionItem[]>([]);

  useEffect(() => {
    const allOrders = db.getAllOrders().filter(o => 
        o.status !== OrderStatus.CANCELLED && 
        o.status !== OrderStatus.DELETED && 
        o.status !== OrderStatus.DRAFT
    );
    const allProducts = db.getAllProducts();

    if (allOrders.length === 0) {
        setForecastMessage(t('analytics.noData'));
        // Initialize empty state
        setGrowthTrend([{name: 'No Data', val: 0}]);
        setForecastChartData([{ name: 'No Data', hist: 0, fc: null }]);
        setPredictions([
            { name: 'Data Pending', growth: '--', badge: 'Waiting...', isPositive: true },
            { name: 'Data Pending', growth: '--', badge: 'Waiting...', isPositive: true },
            { name: 'Data Pending', growth: '--', badge: 'Waiting...', isPositive: true },
            { name: 'Data Pending', growth: '--', badge: 'Waiting...', isPositive: true },
        ]);
        return;
    }

    // 1. Determine Time Span
    const timestamps = allOrders.map(o => new Date(o.date).getTime()).filter(t => !isNaN(t));
    if (timestamps.length === 0) return;
    
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const daySpan = (maxTime - minTime) / (1000 * 3600 * 24);

    let mode: 'daily' | 'weekly' | 'monthly' = 'monthly';
    if (daySpan <= 60) mode = 'daily';
    else if (daySpan <= 730) mode = 'weekly';
    else mode = 'monthly';

    // 2. Aggregate Data
    const aggregatedUnits: Record<string, number> = {};
    const aggregatedRevenue: Record<string, number> = {};
    const productSalesCurrent: Record<string, number> = {}; // For top products (current period)
    const productSalesPrevious: Record<string, number> = {}; // For top products (previous period)
    let totalRev = 0;

    // Helper to format keys
    const getKey = (d: Date) => {
        if (mode === 'daily') return d.toISOString().split('T')[0]; // YYYY-MM-DD
        if (mode === 'weekly') {
            const start = getStartOfWeek(d);
            return start.toISOString().split('T')[0]; // Use start of week date
        }
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
    };

    // Calculate current period start for product trends (last 7 days, last 30 days, or last month)
    const now = new Date();
    let trendCutoff = new Date();
    let prevTrendCutoff = new Date();
    
    if (mode === 'daily') {
        trendCutoff.setDate(now.getDate() - 7);
        prevTrendCutoff.setDate(now.getDate() - 14);
    } else if (mode === 'weekly') {
        trendCutoff.setDate(now.getDate() - 30);
        prevTrendCutoff.setDate(now.getDate() - 60);
    } else {
        trendCutoff.setMonth(now.getMonth() - 1);
        prevTrendCutoff.setMonth(now.getMonth() - 2);
    }

    allOrders.forEach(o => {
        const dateObj = new Date(o.date);
        if (!isNaN(dateObj.getTime())) {
            const key = getKey(dateObj);
            aggregatedRevenue[key] = (aggregatedRevenue[key] || 0) + o.total;
            totalRev += o.total;

            const t = dateObj.getTime();
            const inCurrent = t >= trendCutoff.getTime();
            const inPrevious = t < trendCutoff.getTime() && t >= prevTrendCutoff.getTime();

            o.items.forEach(item => {
                aggregatedUnits[key] = (aggregatedUnits[key] || 0) + item.quantity;
                
                if (inCurrent) {
                    productSalesCurrent[item.productId] = (productSalesCurrent[item.productId] || 0) + item.quantity;
                }
                if (inPrevious) {
                    productSalesPrevious[item.productId] = (productSalesPrevious[item.productId] || 0) + item.quantity;
                }
            });
        }
    });
    setTotalRevenue(totalRev);

    // 3. Fill Gaps in Timeline
    const timelineData: { date: Date, key: string, units: number, revenue: number }[] = [];
    const startDate = new Date(minTime);
    const endDate = new Date(maxTime);
    
    // Normalize start based on mode
    let current = mode === 'daily' ? getStartOfDay(startDate) 
                : mode === 'weekly' ? getStartOfWeek(startDate) 
                : getStartOfMonth(startDate);

    // Guard against infinite loop if date logic fails
    let loopGuard = 0;
    while (current <= endDate && loopGuard < 1000) {
        const key = getKey(current);
        timelineData.push({
            date: new Date(current),
            key: key,
            units: aggregatedUnits[key] || 0,
            revenue: aggregatedRevenue[key] || 0
        });

        // Increment
        if (mode === 'daily') current.setDate(current.getDate() + 1);
        else if (mode === 'weekly') current.setDate(current.getDate() + 7);
        else current.setMonth(current.getMonth() + 1);
        
        loopGuard++;
    }

    // 4. Configure Forecast Parameters
    let seasonLength = 12; 
    let forecastLength = 6;
    let resolutionLabel: 'Day' | 'Week' | 'Month' = 'Month';

    if (mode === 'daily') {
        seasonLength = 7; // Weekly seasonality
        forecastLength = 7; // Forecast next week
        resolutionLabel = 'Day';
    } else if (mode === 'weekly') {
        seasonLength = 4; // Monthly seasonality (approx 4 weeks)
        forecastLength = 8; // Forecast next 2 months
        resolutionLabel = 'Week';
    }

    setTimeResolution(resolutionLabel);

    // 5. Run Forecasting
    const historyValues = timelineData.map(d => d.units);
    const isSufficient = historyValues.length >= seasonLength * 2;
    setHasSufficientData(isSufficient);

    if (!isSufficient) {
        setForecastMessage(`Data accumulation in progress. Need ${seasonLength * 2} ${resolutionLabel.toLowerCase()}s (Have ${historyValues.length}).`);
    } else {
        setForecastMessage(`Projecting demand by ${resolutionLabel} (Holt-Winters)`);
    }

    let forecastedValues: number[] = [];
    if (isSufficient) {
        // Tuned parameters for general retail
        forecastedValues = holtWintersForecast(historyValues, seasonLength, 0.3, 0.1, 0.1, forecastLength);
    }

    // 6. Build Chart Payload
    const chartData = [];
    const formatLabel = (d: Date) => {
        if (mode === 'daily') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (mode === 'weekly') {
            // For weekly, show "M/D"
            return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
        }
        return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    };

    // Add History
    timelineData.forEach(pt => {
        chartData.push({
            name: formatLabel(pt.date),
            hist: pt.units,
            fc: null as number | null
        });
    });

    // Add Forecast
    if (isSufficient && forecastedValues.length > 0) {
        // Start from next interval
        const lastDate = new Date(timelineData[timelineData.length - 1].date);
        
        for (let i = 0; i < forecastedValues.length; i++) {
            if (mode === 'daily') lastDate.setDate(lastDate.getDate() + 1);
            else if (mode === 'weekly') lastDate.setDate(lastDate.getDate() + 7);
            else lastDate.setMonth(lastDate.getMonth() + 1);

            chartData.push({
                name: formatLabel(lastDate),
                hist: null,
                fc: Math.round(forecastedValues[i])
            });
        }
    } else if (chartData.length === 0) {
        chartData.push({ name: 'No Data', hist: 0, fc: null });
    }

    setForecastChartData(chartData);

    // --- Growth Sparkline (Aligned with timeline) ---
    setGrowthTrend(timelineData.map(d => ({ name: d.key, val: d.revenue })));

    if (timelineData.length >= 2) {
        const lastVal = timelineData[timelineData.length - 1].revenue;
        const prevVal = timelineData[timelineData.length - 2].revenue;
        if (prevVal === 0) {
            setGrowthPercentage(lastVal > 0 ? 100 : 0);
            setIsGrowthPositive(true);
        } else {
            const pct = ((lastVal - prevVal) / prevVal) * 100;
            setGrowthPercentage(Math.abs(pct));
            setIsGrowthPositive(pct >= 0);
        }
    }

    // --- Top Products Trend ---
    // Sort by current period volume
    const topProdIds = Object.keys(productSalesCurrent).sort((a,b) => productSalesCurrent[b] - productSalesCurrent[a]).slice(0, 4);
    
    const predCards = topProdIds.map(pid => {
        const p = allProducts.find(x => x.id === pid);
        const curr = productSalesCurrent[pid];
        const prev = productSalesPrevious[pid] || 0;
        
        let trend = 0;
        if (prev > 0) trend = ((curr - prev) / prev) * 100;
        else if (curr > 0) trend = 100;

        let badge = 'Stable';
        if (trend > 20) badge = 'Trending Up';
        if (trend > 50) badge = 'High Demand';
        if (trend < -10) badge = 'Slowing';
        
        return {
            name: p ? p.name : 'Unknown',
            growth: `${trend >= 0 ? '+' : ''}${trend.toFixed(0)}%`,
            badge: badge,
            isPositive: trend >= 0
        };
    });

    if (predCards.length === 0) {
       setPredictions([
            { name: 'Data Pending', growth: '--', badge: 'Waiting...', isPositive: true },
            { name: 'Data Pending', growth: '--', badge: 'Waiting...', isPositive: true },
            { name: 'Data Pending', growth: '--', badge: 'Waiting...', isPositive: true },
            { name: 'Data Pending', growth: '--', badge: 'Waiting...', isPositive: true },
       ]);
    } else {
       setPredictions(predCards);
    }

  }, []);

  const handleExport = () => {
    const csvRows = [];
    const dateStr = new Date().toLocaleDateString();

    // 1. Header
    csvRows.push(['B2B Intel Analytics Report', `Generated: ${dateStr}`]);
    csvRows.push([]); // blank

    // 2. Summary
    csvRows.push(['--- Summary Statistics ---']);
    csvRows.push(['Total Revenue', `ETB ${totalRevenue.toLocaleString()}`]);
    csvRows.push(['Sales Growth', `${isGrowthPositive ? '+' : '-'}${growthPercentage.toFixed(1)}%`]);
    csvRows.push([]);

    // 3. Forecast Data
    csvRows.push(['--- Demand Forecast Data ---']);
    csvRows.push(['Period', 'Historical Units', 'Forecasted Units']);
    forecastChartData.forEach(row => {
        if (row.name === 'No Data') return;
        const hist = row.hist !== null ? row.hist : '';
        const fc = row.fc !== null ? row.fc : '';
        csvRows.push([`"${row.name}"`, hist, fc]);
    });
    csvRows.push([]);

    // 4. Top Products
    csvRows.push(['--- Top Product Trends ---']);
    csvRows.push(['Product Name', 'Metric', 'Status']);
    predictions.forEach(p => {
        csvRows.push([`"${p.name}"`, `"${p.growth}"`, `"${p.badge}"`]);
    });

    // Create and download
    const csvContent = "data:text/csv;charset=utf-8," 
        + csvRows.map(e => e.join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `analytics_report_${dateStr.replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if(!file) return;

    setCustomFileName(file.name);
    setCustomError('');
    setCustomChartData([]);

    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target?.result as string;
        if(!text) return;
        
        try {
            const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
            const parsedData: {date: Date, val: number}[] = [];
            
            lines.forEach((line, index) => {
                const cols = line.split(',');
                if (cols.length < 2) return;
                
                let dateStr = cols[0].trim();
                let valStr = cols[1].trim();
                
                // Skip header if strictly text
                if (index === 0 && isNaN(Date.parse(dateStr)) && isNaN(Number(valStr))) {
                    return;
                }

                const d = new Date(dateStr);
                const v = parseFloat(valStr);

                if (!isNaN(d.getTime()) && !isNaN(v)) {
                    parsedData.push({ date: d, val: v });
                }
            });

            parsedData.sort((a, b) => a.date.getTime() - b.date.getTime());

            if (parsedData.length < 2) {
                setCustomError("Insufficient data points. Please upload a file with at least 2 rows of data.");
                setCustomChartData([]);
                return;
            }

            // 1. Determine Scope based on Total Duration
            const startDate = parsedData[0].date;
            const endDate = parsedData[parsedData.length - 1].date;
            const daySpan = (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24);

            let mode: 'daily' | 'weekly' | 'monthly' = 'monthly';
            if (daySpan <= 60) mode = 'daily';
            else if (daySpan <= 730) mode = 'weekly';
            else mode = 'monthly';

            setCustomResolution(mode.charAt(0).toUpperCase() + mode.slice(1));

            // 2. Aggregate Data based on Scope
            const aggregatedMap: Record<string, number> = {};
            const getKey = (d: Date) => {
                if (mode === 'daily') return d.toISOString().split('T')[0];
                if (mode === 'weekly') {
                    const start = getStartOfWeek(d); 
                    return start.toISOString().split('T')[0];
                }
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            };

            parsedData.forEach(p => {
                const key = getKey(p.date);
                aggregatedMap[key] = (aggregatedMap[key] || 0) + p.val;
            });

            // 3. Build Timeline
            const historySeries: { date: Date, val: number, label: string }[] = [];
            // Start iteration
            let current = mode === 'daily' ? getStartOfDay(startDate) 
                        : mode === 'weekly' ? getStartOfWeek(startDate) 
                        : getStartOfMonth(startDate);
            
            const loopEnd = mode === 'daily' ? getStartOfDay(endDate)
                          : mode === 'weekly' ? getStartOfWeek(endDate)
                          : getStartOfMonth(endDate);

            const formatLabel = (d: Date) => {
                if (mode === 'daily') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                if (mode === 'weekly') return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
                return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            };

            let safety = 0;
            while (current <= loopEnd && safety < 1000) {
                const key = getKey(current);
                const val = aggregatedMap[key] || 0;
                
                historySeries.push({
                    date: new Date(current),
                    val: val,
                    label: formatLabel(current)
                });

                if (mode === 'daily') current.setDate(current.getDate() + 1);
                else if (mode === 'weekly') current.setDate(current.getDate() + 7);
                else current.setMonth(current.getMonth() + 1);
                safety++;
            }

            // 4. Configure Forecast params based on aggregation
            let season = 12;
            let forecastLen = 6;
            
            if (mode === 'daily') {
                season = 7;
                forecastLen = 7;
            } else if (mode === 'weekly') {
                season = 4;
                forecastLen = 8;
            } else {
                // Monthly
                season = 12;
                forecastLen = 6;
            }

            // 5. Run Forecast
            const historyValues = historySeries.map(h => h.val);
            const forecastValues = holtWintersForecast(historyValues, season, 0.3, 0.1, 0.1, forecastLen);

            // 6. Combine
            const combinedData = historySeries.map(h => ({
                name: h.label,
                hist: h.val,
                fc: null as number | null
            }));

            if (forecastValues.length > 0) {
                let lastFcDate = new Date(historySeries[historySeries.length - 1].date);
                
                forecastValues.forEach(fVal => {
                    if (mode === 'daily') lastFcDate.setDate(lastFcDate.getDate() + 1);
                    else if (mode === 'weekly') lastFcDate.setDate(lastFcDate.getDate() + 7);
                    else lastFcDate.setMonth(lastFcDate.getMonth() + 1);

                    combinedData.push({
                        name: formatLabel(lastFcDate),
                        hist: null,
                        fc: Math.round(fVal)
                    });
                });
            }

            setCustomChartData(combinedData);

        } catch (err) {
            setCustomError("Failed to parse file. Ensure format is: Date, Value");
        }
    };
    reader.readAsText(file);
  };

  // Mini Chart Dummy for static cards (Inventory)
  const dummyTrend = [
    { name: '1', val: 10 }, { name: '2', val: 15 }, { name: '3', val: 12 }, { name: '4', val: 20 },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-7xl mx-auto pb-32">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight">{t('analytics.title')}</h1>
          <p className="text-gray-500 font-medium mt-1">{t('analytics.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[160px]">
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 ml-1">{t('analytics.viewScope')}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400">tune</span>
              <select disabled className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-gray-200 rounded-xl text-sm font-bold text-gray-500 shadow-sm cursor-not-allowed">
                <option>Auto ({timeResolution})</option>
              </select>
            </div>
          </div>
          <button 
            onClick={handleExport}
            className="bg-primary text-white p-3 rounded-xl hover:bg-primary-hover shadow-lg shadow-primary/10 active:scale-95 transition-all self-end"
            title="Download Report CSV"
          >
            <span className="material-symbols-outlined block">download</span>
          </button>
        </div>
      </div>

      {/* Mini Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Sales Growth Card */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex justify-between items-start">
            <p className="text-sm font-bold text-gray-500">{t('analytics.salesGrowth')}</p>
            <div className="w-24 h-10">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={growthTrend}>
                  <Line 
                    type="monotone" 
                    dataKey="val" 
                    stroke={isGrowthPositive ? "#10B981" : "#EF4444"} 
                    strokeWidth={3} 
                    dot={false} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <h3 className={`text-3xl font-black ${isGrowthPositive ? 'text-emerald-500' : 'text-red-500'}`}>
            {isGrowthPositive ? '+' : '-'}{growthPercentage.toFixed(1)}%
          </h3>
          <p className="text-xs text-gray-400 flex items-center gap-1 font-bold">
            <span className="material-symbols-outlined text-xs">
                {isGrowthPositive ? 'trending_up' : 'trending_down'}
            </span> 
            {t('analytics.vsPrevious')} {timeResolution.toLowerCase()}
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex justify-between items-start">
            <p className="text-sm font-bold text-gray-500">{t('analytics.totalRevenue')}</p>
            <div className="w-24 h-10">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={growthTrend}>
                  <Line type="monotone" dataKey="val" stroke="#005A9C" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <h3 className="text-3xl font-black text-slate-800">
            {totalRevenue > 1000000 ? `${(totalRevenue/1000000).toFixed(1)}M` : `${(totalRevenue/1000).toFixed(1)}K`} <span className="text-sm text-gray-400">ETB</span>
          </h3>
          <p className="text-xs text-gray-400 flex items-center gap-1 font-bold">
            <span className="material-symbols-outlined text-xs">payments</span> {t('analytics.allTime')}
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex justify-between items-start">
            <p className="text-sm font-bold text-gray-500">{t('analytics.inventoryTurnover')}</p>
            <div className="w-24 h-10">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dummyTrend}>
                  <Line type="monotone" dataKey="val" stroke="#F59E0B" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <h3 className="text-3xl font-black text-slate-800">5.8x</h3>
          <p className="text-xs text-gray-400 flex items-center gap-1 font-bold">
            <span className="material-symbols-outlined text-xs">sync</span> {t('analytics.efficiencyScore')}
          </p>
        </div>
      </div>

      {/* Main Forecast Card */}
      <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary">
              <span className="material-symbols-outlined">auto_awesome</span>
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-800">{t('analytics.demandForecast')} ({timeResolution})</h2>
              <p className="text-sm text-gray-400 font-medium">
                {forecastMessage}
              </p>
            </div>
          </div>
          <div className="flex gap-6 items-center">
             <div className="flex items-center gap-2">
               <span className="w-3 h-3 rounded-full bg-slate-300"></span>
               <span className="text-[10px] font-black text-gray-400 uppercase">{t('analytics.historical')}</span>
             </div>
             {hasSufficientData && (
               <div className="flex items-center gap-2">
                 <span className="w-3 h-3 rounded-full bg-primary"></span>
                 <span className="text-[10px] font-black text-gray-400 uppercase">{t('analytics.forecasted')}</span>
               </div>
             )}
          </div>
        </div>
        <div className="p-6 bg-gray-50/30">
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecastChartData}>
                <defs>
                  <linearGradient id="colorHist" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#CBD5E1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#CBD5E1" stopOpacity={0}/>
                  </linearGradient>
                  {hasSufficientData && (
                    <linearGradient id="colorFc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#005A9C" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#005A9C" stopOpacity={0}/>
                    </linearGradient>
                  )}
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} minTickGap={30} />
                <YAxis stroke="#94A3B8" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                />
                <Area 
                    type="monotone" 
                    dataKey="hist" 
                    name={t('analytics.historical')}
                    stroke="#94A3B8" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorHist)" 
                    connectNulls={true}
                />
                {hasSufficientData && (
                  <Area 
                      type="monotone" 
                      dataKey="fc" 
                      name={t('analytics.forecasted')}
                      stroke="#005A9C" 
                      strokeWidth={4} 
                      strokeDasharray="8 4" 
                      fillOpacity={1} 
                      fill="url(#colorFc)" 
                      connectNulls={true}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Scenario Modeling (Custom CSV) */}
      <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
              <span className="material-symbols-outlined">analytics</span>
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-800">{t('analytics.scenarioTitle')}</h2>
              <p className="text-sm text-gray-400 font-medium">{t('analytics.scenarioDesc')}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <input 
               type="file" 
               accept=".csv,.txt"
               ref={fileInputRef} 
               onChange={handleFileUpload}
               className="hidden" 
             />
             <button 
               onClick={() => fileInputRef.current?.click()}
               className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-200 active:scale-95 transition-all flex items-center gap-2"
             >
               <span className="material-symbols-outlined text-sm">upload_file</span>
               {customFileName ? t('analytics.changeFile') : t('analytics.uploadCsv')}
             </button>
          </div>
        </div>

        <div className="p-6 bg-gray-50/30">
           {customChartData.length > 0 ? (
             <div className="space-y-4">
                <div className="flex justify-between items-center px-2">
                   <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">{customFileName} ({customResolution})</p>
                   <button onClick={() => {setCustomChartData([]); setCustomFileName('');}} className="text-xs text-gray-400 hover:text-red-500 font-bold underline">{t('analytics.clearData')}</button>
                </div>
                <div className="overflow-x-auto pb-4">
                    <div style={{ minWidth: '100%', width: `${Math.max(800, customChartData.length * 50)}px`, height: '350px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={customChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                            <linearGradient id="colorCustomHist" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#818CF8" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#818CF8" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorCustomFc" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                            </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} minTickGap={30} />
                            <YAxis stroke="#94A3B8" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                            <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="hist" 
                                name="Uploaded Data"
                                stroke="#818CF8" 
                                strokeWidth={3} 
                                fillOpacity={1} 
                                fill="url(#colorCustomHist)" 
                                connectNulls={true}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="fc" 
                                name="Forecast"
                                stroke="#4F46E5" 
                                strokeWidth={4} 
                                strokeDasharray="8 4" 
                                fillOpacity={1} 
                                fill="url(#colorCustomFc)" 
                                connectNulls={true}
                            />
                        </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
             </div>
           ) : (
             <div 
               onClick={() => fileInputRef.current?.click()}
               className="border-3 border-dashed border-gray-200 rounded-3xl p-12 flex flex-col items-center justify-center text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group"
             >
                <div className="size-16 rounded-full bg-white shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                   <span className="material-symbols-outlined text-3xl text-gray-300 group-hover:text-indigo-500">cloud_upload</span>
                </div>
                <h3 className="text-base font-black text-slate-700 group-hover:text-indigo-600 transition-colors">{t('analytics.dropCsv')}</h3>
                <p className="text-xs text-gray-400 font-medium mt-1">{t('analytics.csvFormat')}</p>
                {customError && (
                    <div className="mt-4 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">error</span>
                        {customError}
                    </div>
                )}
             </div>
           )}
        </div>
      </section>

      {/* Predictions Grid */}
      <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center gap-3">
          <span className="material-symbols-outlined text-emerald-600">trending_up</span>
          <h2 className="text-lg font-black text-slate-800">{t('analytics.topTrends')} <span className="text-gray-400 font-bold ml-2">({t('analytics.recentVsPrev')})</span></h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-50">
          {predictions.map((item, i) => (
            <div key={i} className="p-6 space-y-4 hover:bg-gray-50 transition-colors cursor-pointer">
              <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest leading-relaxed h-8 line-clamp-2">{item.name}</p>
              <div className="flex items-end justify-between">
                <span className={`text-2xl font-black ${item.isPositive ? 'text-emerald-500' : 'text-red-500'}`}>{item.growth}</span>
                <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${item.isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                    {item.badge}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Analytics;
