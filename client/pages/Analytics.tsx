
import React, { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { OrderStatus, Order, Product } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

type ForecastModel = 'holt-winters' | 'fb-prophet';

const extractArray = <T,>(payload: any): T[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

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

  if (zeroRatio > 0.6) {
    const window = Math.min(6, clean.length);
    const recent = clean.slice(-window);
    const prev = clean.slice(-(window * 2), -window);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / Math.max(1, recent.length);
    const prevAvg = prev.length > 0 ? prev.reduce((a, b) => a + b, 0) / prev.length : recentAvg;
    const trend = (recentAvg - prevAvg) * 0.35;
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

  for (let i = 0; i < seasonLength; i++) seasonals[i] = clean[i] - avg1;

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

const getModelLabel = (model: ForecastModel) => (model === 'fb-prophet' ? 'FB Prophet' : 'Holt-Winters');

const buildClientForecast = (orders: Order[], model: ForecastModel, productId?: string) => {
  const scopedOrders = productId
    ? orders.filter((o) => o.items.some((item) => item.productId === productId))
    : orders;

  if (scopedOrders.length === 0) {
    return {
      chartData: [{ name: 'No Data', hist: 0, fc: null }],
      message: productId ? 'No order history found for this product.' : 'No sales data available.',
      hasSufficientData: false,
      timeResolution: 'Month' as const,
      modelUsed: 'holt-winters' as const
    };
  }

  const timestamps = scopedOrders.map((o) => new Date(o.date).getTime()).filter((t) => !isNaN(t));
  if (timestamps.length === 0) {
    return {
      chartData: [{ name: 'No Data', hist: 0, fc: null }],
      message: productId ? 'No valid date history found for this product.' : 'No sales data available.',
      hasSufficientData: false,
      timeResolution: 'Month' as const,
      modelUsed: 'holt-winters' as const
    };
  }

  const startDate = new Date(Math.min(...timestamps));
  const endDate = new Date(Math.max(...timestamps));

  const buildMode = (mode: 'daily' | 'weekly' | 'monthly') => {
    const aggregated: Record<string, number> = {};
    const getKey = (d: Date) => {
      if (mode === 'daily') return d.toISOString().split('T')[0];
      if (mode === 'weekly') return getStartOfWeek(d).toISOString().split('T')[0];
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    scopedOrders.forEach((order) => {
      const dateObj = new Date(order.date);
      if (isNaN(dateObj.getTime())) return;
      const qty = productId
        ? order.items.filter((item) => item.productId === productId).reduce((sum, item) => sum + item.quantity, 0)
        : order.items.reduce((sum, item) => sum + item.quantity, 0);
      aggregated[getKey(dateObj)] = (aggregated[getKey(dateObj)] || 0) + qty;
    });

    const timeline: Array<{ date: Date; units: number }> = [];
    let current = mode === 'daily' ? getStartOfDay(startDate) : mode === 'weekly' ? getStartOfWeek(startDate) : getStartOfMonth(startDate);
    let guard = 0;
    while (current <= endDate && guard < 1000) {
      const key = getKey(current);
      timeline.push({ date: new Date(current), units: aggregated[key] || 0 });
      if (mode === 'daily') current.setDate(current.getDate() + 1);
      else if (mode === 'weekly') current.setDate(current.getDate() + 7);
      else current.setMonth(current.getMonth() + 1);
      guard++;
    }

    const seasonLength = mode === 'daily' ? 7 : mode === 'weekly' ? 4 : 12;
    const forecastLength = mode === 'daily' ? 7 : mode === 'weekly' ? 8 : 6;
    const timeResolution = mode === 'daily' ? 'Day' : mode === 'weekly' ? 'Week' : 'Month';
    return { mode, seasonLength, forecastLength, timeResolution, timeline };
  };

  const candidates = [buildMode('daily'), buildMode('weekly'), buildMode('monthly')];
  const candidate =
    candidates.find((entry) => entry.timeline.length >= entry.seasonLength * 2) ||
    [...candidates].reverse().find((entry) => entry.timeline.length > 0) ||
    candidates[0];

  const historyValues = candidate.timeline.map((point) => point.units);
  const hasSufficientData = historyValues.length >= candidate.seasonLength * 2;
  const forecastedValues = hasSufficientData
    ? holtWintersForecast(historyValues, candidate.seasonLength, 0.3, 0.1, 0.1, candidate.forecastLength)
    : [];

  const formatLabel = (d: Date) => {
    if (candidate.mode === 'daily') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (candidate.mode === 'weekly') return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  const chartData: Array<{ name: string; hist: number | null; fc: number | null }> = candidate.timeline.map((point) => ({
    name: formatLabel(point.date),
    hist: point.units,
    fc: null
  }));

  if (hasSufficientData && forecastedValues.length > 0 && candidate.timeline.length > 0) {
    const lastDate = new Date(candidate.timeline[candidate.timeline.length - 1].date);
    forecastedValues.forEach((value) => {
      if (candidate.mode === 'daily') lastDate.setDate(lastDate.getDate() + 1);
      else if (candidate.mode === 'weekly') lastDate.setDate(lastDate.getDate() + 7);
      else lastDate.setMonth(lastDate.getMonth() + 1);
      chartData.push({ name: formatLabel(lastDate), hist: null, fc: Math.round(value) });
    });
  }

  return {
    chartData: chartData.length > 0 ? chartData : [{ name: 'No Data', hist: 0, fc: null }],
    message: hasSufficientData
      ? model === 'fb-prophet'
        ? `FB Prophet is unavailable in the browser fallback. Falling back to Holt-Winters for this ${candidate.timeResolution.toLowerCase()} forecast.`
        : `Projecting demand by ${candidate.timeResolution} (Holt-Winters)`
      : `Data accumulation in progress. Need ${candidate.seasonLength * 2} ${candidate.timeResolution.toLowerCase()}s (Have ${historyValues.length}).`,
    hasSufficientData,
    timeResolution: candidate.timeResolution as 'Day' | 'Week' | 'Month',
    modelUsed: 'holt-winters' as const
  };
};

const Analytics: React.FC = () => {
  const { t } = useLanguage();
  const [analyticsProducts, setAnalyticsProducts] = useState<Product[]>([]);
  const [analyticsOrders, setAnalyticsOrders] = useState<Order[]>([]);
  
  // Forecasting State
  const [forecastChartData, setForecastChartData] = useState<any[]>([]);
  const [forecastMessage, setForecastMessage] = useState('');
  const [hasSufficientData, setHasSufficientData] = useState(false);
  const [timeResolution, setTimeResolution] = useState<'Day' | 'Week' | 'Month'>('Month');
  const [forecastModel, setForecastModel] = useState<ForecastModel>('holt-winters');
  const [forecastModelUsed, setForecastModelUsed] = useState<ForecastModel>('holt-winters');
  const [forecastRefreshToken, setForecastRefreshToken] = useState(0);
  const [isGeneratingForecasts, setIsGeneratingForecasts] = useState(false);
  const [forecastGenerationMessage, setForecastGenerationMessage] = useState('');
  const [selectedForecastProductId, setSelectedForecastProductId] = useState('');
  const [productForecastChartData, setProductForecastChartData] = useState<any[]>([]);
  const [productForecastMessage, setProductForecastMessage] = useState('');
  const [hasSufficientProductData, setHasSufficientProductData] = useState(false);
  const [productTimeResolution, setProductTimeResolution] = useState<'Day' | 'Week' | 'Month'>('Month');
  const [productForecastModelUsed, setProductForecastModelUsed] = useState<ForecastModel>('holt-winters');

  // Custom File Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customChartData, setCustomChartData] = useState<any[]>([]);
  const [customFileName, setCustomFileName] = useState('');
  const [customError, setCustomError] = useState('');
  const [customResolution, setCustomResolution] = useState('Auto');

  const normalizeStatus = (value: any): OrderStatus => {
    if (typeof value !== 'string') return OrderStatus.PENDING;
    const map: Record<string, OrderStatus> = {
      DRAFT: OrderStatus.DRAFT,
      ON_REVIEW: OrderStatus.ON_REVIEW,
      'ON REVIEW': OrderStatus.ON_REVIEW,
      PENDING: OrderStatus.PENDING,
      PROCESSING: OrderStatus.PROCESSING,
      SHIPPED: OrderStatus.SHIPPED,
      DELIVERED: OrderStatus.DELIVERED,
      UNDELIVERED: OrderStatus.UNDELIVERED,
      CANCELLED: OrderStatus.CANCELLED,
      CANCELED: OrderStatus.CANCELLED,
      DELETED: OrderStatus.DELETED,
      Draft: OrderStatus.DRAFT,
      'On Review': OrderStatus.ON_REVIEW,
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

  const handleGenerateForecasts = async () => {
    setIsGeneratingForecasts(true);
    setForecastGenerationMessage('Generating and storing Holt-Winters and FB Prophet forecasts...');

    try {
      const response = await fetch('/api/orders/metrics/demand-forecast/generate', {
        method: 'POST',
        credentials: 'include'
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to generate forecasts');
      }

      const modelsCount = Array.isArray(payload?.models) ? payload.models.length : 2;
      const productCount = Number(payload?.productCount || 0);
      setForecastGenerationMessage(
        `Stored refreshed forecasts for ${modelsCount} models across ${productCount} products.`
      );
      setForecastRefreshToken((value) => value + 1);
    } catch (err) {
      console.error('Generate forecasts error:', err);
      setForecastGenerationMessage(
        err instanceof Error ? err.message : 'Failed to generate forecasts'
      );
    } finally {
      setIsGeneratingForecasts(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ordersResult, productsResult, forecastResult] = await Promise.allSettled([
          fetch('/api/orders', { credentials: 'include' }),
          fetch('/api/products', { credentials: 'include' }),
          fetch(`/api/orders/metrics/demand-forecast?model=${encodeURIComponent(forecastModel)}`, { credentials: 'include' })
        ]);

        if (ordersResult.status !== 'fulfilled' || !ordersResult.value.ok) throw new Error('Failed to fetch orders');
        if (productsResult.status !== 'fulfilled' || !productsResult.value.ok) throw new Error('Failed to fetch products');

        const ordersPayload = await ordersResult.value.json();
        const productsPayload = await productsResult.value.json();
        const ordersData = extractArray<Order>(ordersPayload);
        const productsData = extractArray<Product>(productsPayload);
        const forecastData =
          forecastResult.status === 'fulfilled' && forecastResult.value.ok
            ? await forecastResult.value.json()
            : null;

        const allOrders = ordersData
          .map(o => ({ ...o, status: normalizeStatus(o.status) }))
          .filter(o => ![OrderStatus.DRAFT, OrderStatus.CANCELLED, OrderStatus.DELETED].includes(o.status));
        setAnalyticsOrders(allOrders);

        const allProducts = productsData;
        setAnalyticsProducts(allProducts);
        if (!selectedForecastProductId && allProducts.length > 0) {
          setSelectedForecastProductId(allProducts[0].id);
        }

        const fallbackForecast = buildClientForecast(allOrders, forecastModel);
        const resolvedForecast = forecastData && Array.isArray(forecastData?.chartData) ? forecastData : fallbackForecast;
        setForecastMessage(resolvedForecast?.message || t('analytics.noData'));
        setForecastChartData(Array.isArray(resolvedForecast?.chartData) ? resolvedForecast.chartData : [{ name: 'No Data', hist: 0, fc: null }]);
        setHasSufficientData(Boolean(resolvedForecast?.hasSufficientData));
        setTimeResolution((resolvedForecast?.timeResolution as 'Day' | 'Week' | 'Month') || 'Month');
        setForecastModelUsed((resolvedForecast?.modelUsed as ForecastModel) || 'holt-winters');
      } catch (err) {
        console.error('Analytics fetch error:', err);
        setForecastMessage(t('analytics.noData'));
        setForecastChartData([{ name: 'No Data', hist: 0, fc: null }]);
      }
    };

    fetchData();
  }, [forecastModel, forecastRefreshToken, t]);

  useEffect(() => {
    if (!selectedForecastProductId) {
      setHasSufficientProductData(false);
      setProductTimeResolution('Month');
      setProductForecastMessage('Select a product to forecast demand.');
      setProductForecastChartData([{ name: 'No Data', hist: 0, fc: null }]);
      setProductForecastModelUsed('holt-winters');
      return;
    }
    const loadProductForecast = async () => {
      try {
        const response = await fetch(`/api/orders/metrics/demand-forecast?productId=${encodeURIComponent(selectedForecastProductId)}&model=${encodeURIComponent(forecastModel)}`, {
          credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to fetch product forecast');
        const data = await response.json();
        setHasSufficientProductData(Boolean(data?.hasSufficientData));
        setProductTimeResolution((data?.timeResolution as 'Day' | 'Week' | 'Month') || 'Month');
        setProductForecastMessage(data?.message || 'No order history found for this product.');
        setProductForecastChartData(Array.isArray(data?.chartData) ? data.chartData : [{ name: 'No Data', hist: 0, fc: null }]);
        setProductForecastModelUsed((data?.modelUsed as ForecastModel) || 'holt-winters');
      } catch (err) {
        console.error('Product forecast fetch error:', err);
        const fallback = buildClientForecast(analyticsOrders, forecastModel, selectedForecastProductId);
        setHasSufficientProductData(Boolean(fallback.hasSufficientData));
        setProductTimeResolution(fallback.timeResolution);
        setProductForecastMessage(fallback.message);
        setProductForecastChartData(fallback.chartData);
        setProductForecastModelUsed(fallback.modelUsed);
      }
    };

    loadProductForecast();
  }, [analyticsOrders, forecastModel, selectedForecastProductId, forecastRefreshToken]);

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
      <div className="flex flex-col gap-2">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight">{t('analytics.title')}</h1>
          <p className="text-gray-500 font-medium mt-1">{t('analytics.subtitle')}</p>
        </div>
      </div>

      <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Forecast Model</p>
            <h2 className="mt-1 text-lg font-extrabold text-slate-800">Choose Forecast Engine</h2>
            <p className="text-sm font-medium text-gray-500">
              Forecasting runs on the server. If FB Prophet is unavailable there, the report falls back to Holt-Winters automatically.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end">
            <div className="inline-flex rounded-2xl bg-slate-100 p-1.5">
              {[
                { id: 'holt-winters' as const, label: 'Holt-Winters' },
                { id: 'fb-prophet' as const, label: 'FB Prophet' }
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setForecastModel(option.id)}
                  className={`rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-all ${
                    forecastModel === option.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleGenerateForecasts}
              disabled={isGeneratingForecasts}
              className={`rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-all ${
                isGeneratingForecasts
                  ? 'cursor-not-allowed bg-slate-200 text-slate-500'
                  : 'bg-slate-900 text-white shadow-sm hover:bg-slate-800'
              }`}
            >
              {isGeneratingForecasts ? 'Generating...' : 'Generate Forecasts'}
            </button>
            {forecastGenerationMessage && (
              <p className="max-w-sm text-right text-xs font-semibold text-gray-500">
                {forecastGenerationMessage}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Main Forecast Card */}
      <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary">
              <span className="material-symbols-outlined">auto_awesome</span>
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-800">
                {t('analytics.demandForecast')} ({timeResolution}) - {getModelLabel(forecastModelUsed)}
              </h2>
              <p className="text-sm text-gray-400 font-medium">{forecastMessage}</p>
            </div>
            <div className="hidden">
              <h2 className="text-xl font-extrabold text-slate-800">
                {t('analytics.demandForecast')} ({timeResolution}) {forecastModel === 'fb-prophet' ? '• FB Prophet' : '• Holt-Winters'}
              </h2>
              <p className="text-sm text-gray-400 font-medium">
                {forecastModel === 'fb-prophet'
                  ? 'FB Prophet toggle is ready. Current forecast output is still driven by Holt-Winters until Prophet is implemented.'
                  : forecastMessage}
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
              <h2 className="text-xl font-extrabold text-slate-800">
                Product Demand Forecast ({productTimeResolution}) - {getModelLabel(productForecastModelUsed)}
              </h2>
              <p className="text-sm text-gray-400 font-medium">{productForecastMessage}</p>
            </div>
            <div className="hidden">
              <h2 className="text-xl font-extrabold text-slate-800">
                Product Demand Forecast ({productTimeResolution}) {forecastModel === 'fb-prophet' ? '• FB Prophet' : '• Holt-Winters'}
              </h2>
              <p className="text-sm text-gray-400 font-medium">
                {forecastModel === 'fb-prophet'
                  ? 'FB Prophet toggle is ready. Product forecast output still uses Holt-Winters until Prophet is implemented.'
                  : productForecastMessage}
              </p>
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

    </div>
  );
};

export default Analytics;
