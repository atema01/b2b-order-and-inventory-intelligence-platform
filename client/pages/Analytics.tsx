
import React, { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { OrderStatus, Order, Product } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

// Holt-Winters Additive (robust against sparse/zero-heavy demand)
const holtWintersForecast = (
  data: number[],
  seasonLength: number,
  alpha: number = 0.3,
  beta: number = 0.1,
  gamma: number = 0.1,
  forecastLength: number
) => {
  if (data.length < seasonLength * 2) return [];

  const clean = data.map((v) => (Number.isFinite(v) ? Math.max(0, v) : 0));
  const zeroRatio = clean.filter((v) => v === 0).length / clean.length;

  // Fallback for very sparse series to avoid unstable seasonal extrapolation
  if (zeroRatio > 0.6) {
    const window = Math.min(6, clean.length);
    const recent = clean.slice(-window);
    const prev = clean.slice(-(window * 2), -window);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / Math.max(1, recent.length);
    const prevAvg = prev.length > 0 ? prev.reduce((a, b) => a + b, 0) / prev.length : recentAvg;
    const trend = (recentAvg - prevAvg) * 0.35; // damped
    const cap = Math.max(1, recentAvg * 3);

    return Array.from({ length: forecastLength }, (_, i) => {
      const val = recentAvg + trend * (i + 1);
      return Math.max(0, Math.min(cap, val));
    });
  }

  const firstSeason = clean.slice(0, seasonLength);
  const secondSeason = clean.slice(seasonLength, seasonLength * 2);
  const avg1 = firstSeason.reduce((a, b) => a + b, 0) / seasonLength;
  const avg2 = secondSeason.reduce((a, b) => a + b, 0) / seasonLength;

  let level = avg1;
  let trend = (avg2 - avg1) / seasonLength;
  const seasonals = new Array(clean.length).fill(0);

  for (let i = 0; i < seasonLength; i++) {
    seasonals[i] = clean[i] - avg1;
  }

  for (let t = seasonLength; t < clean.length; t++) {
    const y = clean[t];
    const prevLevel = level;
    const prevSeason = seasonals[t - seasonLength] ?? 0;

    level = alpha * (y - prevSeason) + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    seasonals[t] = gamma * (y - level) + (1 - gamma) * prevSeason;
  }

  const recentAvg = clean.slice(-Math.min(6, clean.length)).reduce((a, b) => a + b, 0) / Math.min(6, clean.length);
  const cap = Math.max(1, recentAvg * 4);

  const forecasts: number[] = [];
  for (let m = 1; m <= forecastLength; m++) {
    const sIdx = clean.length - seasonLength + ((m - 1) % seasonLength);
    const seasonal = seasonals[sIdx] ?? 0;
    const value = level + m * trend + seasonal;
    forecasts.push(Math.max(0, Math.min(cap, value)));
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
  const [inventoryTurnover, setInventoryTurnover] = useState(0);
  const [inventoryTurnoverTrend, setInventoryTurnoverTrend] = useState<{name: string, val: number}[]>([]);
  const [deliveredOrders, setDeliveredOrders] = useState<Order[]>([]);
  const [analyticsProducts, setAnalyticsProducts] = useState<Product[]>([]);
  
  // Forecasting State
  const [forecastChartData, setForecastChartData] = useState<any[]>([]);
  const [forecastMessage, setForecastMessage] = useState('');
  const [hasSufficientData, setHasSufficientData] = useState(false);
  const [timeResolution, setTimeResolution] = useState<'Day' | 'Week' | 'Month'>('Month');
  const [selectedForecastProductId, setSelectedForecastProductId] = useState('');
  const [productForecastChartData, setProductForecastChartData] = useState<any[]>([]);
  const [productForecastMessage, setProductForecastMessage] = useState('');
  const [hasSufficientProductData, setHasSufficientProductData] = useState(false);
  const [productTimeResolution, setProductTimeResolution] = useState<'Day' | 'Week' | 'Month'>('Month');

  // Custom File Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customChartData, setCustomChartData] = useState<any[]>([]);
  const [customFileName, setCustomFileName] = useState('');
  const [customError, setCustomError] = useState('');
  const [customResolution, setCustomResolution] = useState('Auto');

  // Prediction State
  const [predictions, setPredictions] = useState<PredictionItem[]>([]);

  const normalizeStatus = (value: any): OrderStatus => {
    if (typeof value !== 'string') return OrderStatus.PENDING;
    const map: Record<string, OrderStatus> = {
      DRAFT: OrderStatus.DRAFT,
      PENDING: OrderStatus.PENDING,
      PROCESSING: OrderStatus.PROCESSING,
      SHIPPED: OrderStatus.SHIPPED,
      DELIVERED: OrderStatus.DELIVERED,
      UNDELIVERED: OrderStatus.UNDELIVERED,
      CANCELLED: OrderStatus.CANCELLED,
      CANCELED: OrderStatus.CANCELLED,
      DELETED: OrderStatus.DELETED,
      Draft: OrderStatus.DRAFT,
      Pending: OrderStatus.PENDING,
      Processing: OrderStatus.PROCESSING,
      Shipped: OrderStatus.SHIPPED,
      Delivered: OrderStatus.DELIVERED,
      Undelivered: OrderStatus.UNDELIVERED,
      Cancelled: OrderStatus.CANCELLED,
      Canceled: OrderStatus.CANCELLED,
      Deleted: OrderStatus.DELETED
    };
    return map[value] || OrderStatus.PENDING;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ordersRes, productsRes, turnoverRes] = await Promise.all([
          fetch('/api/orders', { credentials: 'include' }),
          fetch('/api/products', { credentials: 'include' }),
          fetch('/api/orders/metrics/inventory-turnover', { credentials: 'include' })
        ]);

        if (!ordersRes.ok) throw new Error('Failed to fetch orders');
        if (!productsRes.ok) throw new Error('Failed to fetch products');

        const [ordersData, productsData]: [Order[], Product[]] = await Promise.all([
          ordersRes.json(),
          productsRes.json()
        ]);

        if (turnoverRes.ok) {
          const turnoverData = await turnoverRes.json();
          setInventoryTurnover(Number(turnoverData.turnover || 0));
          setInventoryTurnoverTrend(
            Array.isArray(turnoverData.trend) && turnoverData.trend.length > 0
              ? turnoverData.trend
              : [{ name: 'No Data', val: 0 }]
          );
        } else {
          setInventoryTurnover(0);
          setInventoryTurnoverTrend([{ name: 'No Data', val: 0 }]);
        }

        const allOrders = ordersData
          .map(o => ({ ...o, status: normalizeStatus(o.status) }))
          .filter(o => o.status === OrderStatus.DELIVERED);

        const allProducts = productsData;
        setDeliveredOrders(allOrders);
        setAnalyticsProducts(allProducts);
        if (!selectedForecastProductId && allProducts.length > 0) {
          setSelectedForecastProductId(allProducts[0].id);
        }

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
      } catch (err) {
        console.error('Analytics fetch error:', err);
        setForecastMessage(t('analytics.noData'));
        setGrowthTrend([{name: 'No Data', val: 0}]);
        setInventoryTurnover(0);
        setInventoryTurnoverTrend([{ name: 'No Data', val: 0 }]);
        setForecastChartData([{ name: 'No Data', hist: 0, fc: null }]);
        setPredictions([
            { name: 'Data Pending', growth: '--', badge: 'Waiting...', isPositive: true },
            { name: 'Data Pending', growth: '--', badge: 'Waiting...', isPositive: true },
            { name: 'Data Pending', growth: '--', badge: 'Waiting...', isPositive: true },
            { name: 'Data Pending', growth: '--', badge: 'Waiting...', isPositive: true },
        ]);
      }
    };

    fetchData();
  }, [t]);

  useEffect(() => {
    if (!selectedForecastProductId) {
      setHasSufficientProductData(false);
      setProductTimeResolution('Month');
      setProductForecastMessage('Select a product to forecast demand.');
      setProductForecastChartData([{ name: 'No Data', hist: 0, fc: null }]);
      return;
    }

    const productOrders = deliveredOrders.filter((o) =>
      o.items.some((item) => item.productId === selectedForecastProductId)
    );

    if (productOrders.length === 0) {
      setHasSufficientProductData(false);
      setProductTimeResolution('Month');
      setProductForecastMessage('No delivered order history found for this product.');
      setProductForecastChartData([{ name: 'No Data', hist: 0, fc: null }]);
      return;
    }

    const timestamps = productOrders.map((o) => new Date(o.date).getTime()).filter((ts) => !isNaN(ts));
    if (timestamps.length === 0) {
      setHasSufficientProductData(false);
      setProductTimeResolution('Month');
      setProductForecastMessage('No valid date history found for this product.');
      setProductForecastChartData([{ name: 'No Data', hist: 0, fc: null }]);
      return;
    }

    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const daySpan = (maxTime - minTime) / (1000 * 3600 * 24);

    let mode: 'daily' | 'weekly' | 'monthly' = 'monthly';
    if (daySpan <= 60) mode = 'daily';
    else if (daySpan <= 730) mode = 'weekly';
    else mode = 'monthly';

    const aggregatedUnits: Record<string, number> = {};
    const getKey = (d: Date) => {
      if (mode === 'daily') return d.toISOString().split('T')[0];
      if (mode === 'weekly') return getStartOfWeek(d).toISOString().split('T')[0];
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    productOrders.forEach((o) => {
      const dateObj = new Date(o.date);
      if (isNaN(dateObj.getTime())) return;
      const key = getKey(dateObj);
      const qty = o.items
        .filter((item) => item.productId === selectedForecastProductId)
        .reduce((sum, item) => sum + item.quantity, 0);
      aggregatedUnits[key] = (aggregatedUnits[key] || 0) + qty;
    });

    const timelineData: { date: Date; key: string; units: number }[] = [];
    const startDate = new Date(minTime);
    const endDate = new Date(maxTime);
    let current = mode === 'daily'
      ? getStartOfDay(startDate)
      : mode === 'weekly'
        ? getStartOfWeek(startDate)
        : getStartOfMonth(startDate);

    let loopGuard = 0;
    while (current <= endDate && loopGuard < 1000) {
      const key = getKey(current);
      timelineData.push({
        date: new Date(current),
        key,
        units: aggregatedUnits[key] || 0
      });
      if (mode === 'daily') current.setDate(current.getDate() + 1);
      else if (mode === 'weekly') current.setDate(current.getDate() + 7);
      else current.setMonth(current.getMonth() + 1);
      loopGuard++;
    }

    let seasonLength = 12;
    let forecastLength = 6;
    let resolutionLabel: 'Day' | 'Week' | 'Month' = 'Month';
    if (mode === 'daily') {
      seasonLength = 7;
      forecastLength = 7;
      resolutionLabel = 'Day';
    } else if (mode === 'weekly') {
      seasonLength = 4;
      forecastLength = 8;
      resolutionLabel = 'Week';
    }
    setProductTimeResolution(resolutionLabel);

    const historyValues = timelineData.map((d) => d.units);
    const isSufficient = historyValues.length >= seasonLength * 2;
    setHasSufficientProductData(isSufficient);
    if (!isSufficient) {
      setProductForecastMessage(
        `Data accumulation in progress. Need ${seasonLength * 2} ${resolutionLabel.toLowerCase()}s (Have ${historyValues.length}).`
      );
    } else {
      setProductForecastMessage(`Projecting demand by ${resolutionLabel} (Holt-Winters)`);
    }

    let forecastedValues: number[] = [];
    if (isSufficient) {
      forecastedValues = holtWintersForecast(historyValues, seasonLength, 0.3, 0.1, 0.1, forecastLength);
    }

    const formatLabel = (d: Date) => {
      if (mode === 'daily') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (mode === 'weekly') return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
      return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    };

    const chartData: { name: string; hist: number | null; fc: number | null }[] = timelineData.map((pt) => ({
      name: formatLabel(pt.date),
      hist: pt.units,
      fc: null
    }));

    if (isSufficient && forecastedValues.length > 0) {
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

    setProductForecastChartData(chartData);
  }, [deliveredOrders, selectedForecastProductId]);

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
                <LineChart data={inventoryTurnoverTrend}>
                  <Line type="monotone" dataKey="val" stroke="#F59E0B" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <h3 className="text-3xl font-black text-slate-800">{inventoryTurnover.toFixed(2)}x</h3>
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

      {/* Product Forecast Card */}
      <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
              <span className="material-symbols-outlined">inventory_2</span>
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-800">Product Demand Forecast ({productTimeResolution})</h2>
              <p className="text-sm text-gray-400 font-medium">{productForecastMessage}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 min-w-[260px]">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Select Product</label>
            <select
              value={selectedForecastProductId}
              onChange={(e) => setSelectedForecastProductId(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-slate-700 shadow-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="">Choose product...</option>
              {analyticsProducts.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
          </div>
        </div>
        <div className="p-6 bg-gray-50/30">
          <div className="flex gap-6 items-center mb-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-slate-300"></span>
              <span className="text-[10px] font-black text-gray-400 uppercase">{t('analytics.historical')}</span>
            </div>
            {hasSufficientProductData && (
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-600"></span>
                <span className="text-[10px] font-black text-gray-400 uppercase">{t('analytics.forecasted')}</span>
              </div>
            )}
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={productForecastChartData}>
                <defs>
                  <linearGradient id="colorProductHist" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#CBD5E1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#CBD5E1" stopOpacity={0}/>
                  </linearGradient>
                  {hasSufficientProductData && (
                    <linearGradient id="colorProductFc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                    </linearGradient>
                  )}
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} minTickGap={30} />
                <YAxis stroke="#94A3B8" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }} />
                <Area
                  type="monotone"
                  dataKey="hist"
                  name={t('analytics.historical')}
                  stroke="#94A3B8"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorProductHist)"
                  connectNulls={true}
                />
                {hasSufficientProductData && (
                  <Area
                    type="monotone"
                    dataKey="fc"
                    name={t('analytics.forecasted')}
                    stroke="#059669"
                    strokeWidth={4}
                    strokeDasharray="8 4"
                    fillOpacity={1}
                    fill="url(#colorProductFc)"
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
