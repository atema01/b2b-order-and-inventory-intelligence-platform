import { createHash } from 'crypto';
import pool from '../config/db';
import { runFbProphetForecast, ProphetFrequency } from './fbProphetService';

export type ForecastModel = 'holt-winters' | 'fb-prophet';
export type ForecastGenerationSource = 'manual' | 'scheduled' | 'on-demand';
type ForecastScope = 'overall' | 'product';

interface ForecastOrder {
  id: string;
  date: string;
  items: Array<{ productId: string; quantity: number }>;
}

export interface StoredForecastPayload {
  chartData: Array<{ name: string; hist: number | null; fc: number | null }>;
  message: string;
  hasSufficientData: boolean;
  timeResolution: 'Day' | 'Week' | 'Month';
  modelRequested: ForecastModel;
  modelUsed: ForecastModel;
  generatedAt: string | null;
  generationSource: ForecastGenerationSource | null;
}

interface GenerateAllForecastsSummary {
  startedAt: string;
  finishedAt: string;
  generatedCount: number;
  productCount: number;
  models: ForecastModel[];
  source: ForecastGenerationSource;
}

const FORECAST_ELIGIBLE_STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'UNDELIVERED'];
const FORECAST_MODELS: ForecastModel[] = ['holt-winters', 'fb-prophet'];
const OVERALL_SCOPE_KEY = '__overall__';

let activeGenerationPromise: Promise<GenerateAllForecastsSummary> | null = null;

const parseInteger = (value: any): number => {
  if (typeof value === 'number') return Math.floor(value);
  if (typeof value === 'string') {
    const num = parseInt(value, 10);
    return Number.isNaN(num) ? 0 : num;
  }
  return 0;
};

const getStartOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
};

const getStartOfMonth = (date: Date) => {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
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

  const recentAvg =
    clean.slice(-Math.min(6, clean.length)).reduce((a, b) => a + b, 0) / Math.min(6, clean.length);
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

const getForecastScopeKey = (productId?: string) => productId || OVERALL_SCOPE_KEY;

const getForecastRecordId = (model: ForecastModel, scope: ForecastScope, scopeKey: string) => {
  const hash = createHash('md5').update(`${model}:${scope}:${scopeKey}`).digest('hex').slice(0, 12);
  return `DF-${hash.toUpperCase()}`;
};

const buildDemandForecastPayload = async (
  model: ForecastModel,
  orders: ForecastOrder[],
  productId?: string
): Promise<Omit<StoredForecastPayload, 'generatedAt' | 'generationSource'>> => {
  let scopedOrders = orders;

  if (productId) {
    scopedOrders = orders.filter((order) => order.items.some((item) => item.productId === productId));
  }

  if (scopedOrders.length === 0) {
    return {
      chartData: [{ name: 'No Data', hist: 0, fc: null }],
      message: productId ? 'No order history found for this product.' : 'No sales data available.',
      hasSufficientData: false,
      timeResolution: 'Month',
      modelRequested: model,
      modelUsed: model
    };
  }

  const timestamps = scopedOrders
    .map((order) => new Date(order.date).getTime())
    .filter((timestamp) => !Number.isNaN(timestamp));

  if (timestamps.length === 0) {
    return {
      chartData: [{ name: 'No Data', hist: 0, fc: null }],
      message: productId ? 'No valid date history found for this product.' : 'No sales data available.',
      hasSufficientData: false,
      timeResolution: 'Month',
      modelRequested: model,
      modelUsed: model
    };
  }

  const startDate = new Date(Math.min(...timestamps));
  const endDate = new Date(Math.max(...timestamps));

  const buildTimelineForMode = (mode: 'daily' | 'weekly' | 'monthly') => {
    const aggregatedUnits: Record<string, number> = {};
    const getKey = (d: Date) => {
      if (mode === 'daily') return d.toISOString().split('T')[0];
      if (mode === 'weekly') return getStartOfWeek(d).toISOString().split('T')[0];
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    scopedOrders.forEach((order) => {
      const dateObj = new Date(order.date);
      if (Number.isNaN(dateObj.getTime())) return;
      const key = getKey(dateObj);
      const quantity = productId
        ? order.items
            .filter((item) => item.productId === productId)
            .reduce((sum, item) => sum + item.quantity, 0)
        : order.items.reduce((sum, item) => sum + item.quantity, 0);
      aggregatedUnits[key] = (aggregatedUnits[key] || 0) + quantity;
    });

    const timelineData: Array<{ date: Date; units: number }> = [];
    let current =
      mode === 'daily'
        ? getStartOfDay(startDate)
        : mode === 'weekly'
          ? getStartOfWeek(startDate)
          : getStartOfMonth(startDate);

    let guard = 0;
    while (current <= endDate && guard < 1000) {
      const key = getKey(current);
      timelineData.push({
        date: new Date(current),
        units: aggregatedUnits[key] || 0
      });

      if (mode === 'daily') current.setDate(current.getDate() + 1);
      else if (mode === 'weekly') current.setDate(current.getDate() + 7);
      else current.setMonth(current.getMonth() + 1);

      guard++;
    }

    let seasonLength = 12;
    let forecastLength = 6;
    let timeResolution: 'Day' | 'Week' | 'Month' = 'Month';

    if (mode === 'daily') {
      seasonLength = 7;
      forecastLength = 7;
      timeResolution = 'Day';
    } else if (mode === 'weekly') {
      seasonLength = 4;
      forecastLength = 8;
      timeResolution = 'Week';
    }

    return { mode, seasonLength, forecastLength, timeResolution, timelineData };
  };

  const candidates = [
    buildTimelineForMode('daily'),
    buildTimelineForMode('weekly'),
    buildTimelineForMode('monthly')
  ];

  const candidate =
    candidates.find((entry) => entry.timelineData.length >= entry.seasonLength * 2) ||
    [...candidates].reverse().find((entry) => entry.timelineData.length > 0) ||
    candidates[0];

  const { mode, seasonLength, forecastLength, timeResolution, timelineData } = candidate;
  const historyValues = timelineData.map((point) => point.units);
  const hasSufficientData = historyValues.length >= seasonLength * 2;

  let modelUsed: ForecastModel = model;
  let forecastedValues: number[] = [];
  let fallbackNote = '';

  if (hasSufficientData) {
    if (model === 'fb-prophet') {
      try {
        const frequency: ProphetFrequency = mode === 'daily' ? 'D' : mode === 'weekly' ? 'W-MON' : 'MS';
        const prophetResult = await runFbProphetForecast({
          history: timelineData.map((point) => ({
            ds: point.date.toISOString().slice(0, 10),
            y: point.units
          })),
          periods: forecastLength,
          frequency
        });
        forecastedValues = prophetResult.forecast;
      } catch (err) {
        modelUsed = 'holt-winters';
        fallbackNote = err instanceof Error ? err.message : 'FB Prophet is unavailable.';
        forecastedValues = holtWintersForecast(historyValues, seasonLength, 0.3, 0.1, 0.1, forecastLength);
      }
    } else {
      forecastedValues = holtWintersForecast(historyValues, seasonLength, 0.3, 0.1, 0.1, forecastLength);
    }
  }

  const formatLabel = (d: Date) => {
    if (mode === 'daily') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (mode === 'weekly') return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  const chartData: Array<{ name: string; hist: number | null; fc: number | null }> = timelineData.map((point) => ({
    name: formatLabel(point.date),
    hist: point.units,
    fc: null
  }));

  if (hasSufficientData && forecastedValues.length > 0 && timelineData.length > 0) {
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
  }

  return {
    chartData: chartData.length > 0 ? chartData : [{ name: 'No Data', hist: 0, fc: null }],
    message: hasSufficientData
      ? modelUsed === 'fb-prophet'
        ? `Projecting demand by ${timeResolution} (FB Prophet)`
        : model === 'fb-prophet' && fallbackNote
          ? `FB Prophet is unavailable on this server. Falling back to Holt-Winters. ${fallbackNote}`
          : `Projecting demand by ${timeResolution} (Holt-Winters)`
      : `Data accumulation in progress. Need ${seasonLength * 2} ${timeResolution.toLowerCase()}s (Have ${historyValues.length}).`,
    hasSufficientData,
    timeResolution,
    modelRequested: model,
    modelUsed
  };
};

const mapStoredForecastRow = (row: any): StoredForecastPayload => ({
  chartData: Array.isArray(row?.chart_data) ? row.chart_data : [],
  message: String(row?.message || ''),
  hasSufficientData: Boolean(row?.has_sufficient_data),
  timeResolution: (row?.time_resolution || 'Month') as 'Day' | 'Week' | 'Month',
  modelRequested: row?.model as ForecastModel,
  modelUsed: row?.model_used as ForecastModel,
  generatedAt: row?.generated_at ? new Date(row.generated_at).toISOString() : null,
  generationSource: (row?.generation_source || null) as ForecastGenerationSource | null
});

export const fetchEligibleForecastOrders = async (): Promise<ForecastOrder[]> => {
  const ordersResult = await pool.query(
    `SELECT id, date
     FROM orders
     WHERE UPPER(status) = ANY($1::text[])
     ORDER BY date ASC`,
    [FORECAST_ELIGIBLE_STATUSES]
  );

  const orderIds = ordersResult.rows.map((row: any) => String(row.id));
  const itemsByOrder = new Map<string, Array<{ productId: string; quantity: number }>>();

  if (orderIds.length > 0) {
    const itemsResult = await pool.query(
      `SELECT order_id, product_id, quantity
       FROM order_items
       WHERE order_id = ANY($1::varchar[])`,
      [orderIds]
    );

    itemsResult.rows.forEach((row: any) => {
      const items = itemsByOrder.get(String(row.order_id)) || [];
      items.push({
        productId: String(row.product_id),
        quantity: parseInteger(row.quantity)
      });
      itemsByOrder.set(String(row.order_id), items);
    });
  }

  return ordersResult.rows.map((row: any) => ({
    id: String(row.id),
    date: String(row.date),
    items: itemsByOrder.get(String(row.id)) || []
  }));
};

const getForecastableProductIds = (orders: ForecastOrder[]) => {
  const productIds = new Set<string>();

  orders.forEach((order) => {
    order.items.forEach((item) => {
      if (item.productId) {
        productIds.add(item.productId);
      }
    });
  });

  return Array.from(productIds).sort();
};

const getExistingProductIds = async (productIds: string[]) => {
  if (productIds.length === 0) return new Set<string>();

  const result = await pool.query(
    `SELECT id
     FROM products
     WHERE id = ANY($1::varchar[])`,
    [productIds]
  );

  return new Set<string>(result.rows.map((row: any) => String(row.id)));
};

const upsertStoredForecast = async (
  model: ForecastModel,
  payload: Omit<StoredForecastPayload, 'generatedAt' | 'generationSource'>,
  source: ForecastGenerationSource,
  productId?: string
) => {
  const scope: ForecastScope = productId ? 'product' : 'overall';
  const scopeKey = getForecastScopeKey(productId);
  const id = getForecastRecordId(model, scope, scopeKey);

  await pool.query(
    `INSERT INTO demand_forecasts (
       id,
       model,
       model_used,
       forecast_scope,
       scope_key,
       product_id,
       time_resolution,
       has_sufficient_data,
       message,
       chart_data,
       generated_at,
       generation_source,
       updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, CURRENT_TIMESTAMP, $11, CURRENT_TIMESTAMP
     )
     ON CONFLICT (model, forecast_scope, scope_key)
     DO UPDATE SET
       model_used = EXCLUDED.model_used,
       product_id = EXCLUDED.product_id,
       time_resolution = EXCLUDED.time_resolution,
       has_sufficient_data = EXCLUDED.has_sufficient_data,
       message = EXCLUDED.message,
       chart_data = EXCLUDED.chart_data,
       generated_at = CURRENT_TIMESTAMP,
       generation_source = EXCLUDED.generation_source,
       updated_at = CURRENT_TIMESTAMP`,
    [
      id,
      model,
      payload.modelUsed,
      scope,
      scopeKey,
      productId || null,
      payload.timeResolution,
      payload.hasSufficientData,
      payload.message,
      JSON.stringify(payload.chartData),
      source
    ]
  );
};

export const getStoredDemandForecast = async (
  model: ForecastModel,
  productId?: string
): Promise<StoredForecastPayload | null> => {
  const scope: ForecastScope = productId ? 'product' : 'overall';
  const scopeKey = getForecastScopeKey(productId);
  const result = await pool.query(
    `SELECT *
     FROM demand_forecasts
     WHERE model = $1 AND forecast_scope = $2 AND scope_key = $3
     LIMIT 1`,
    [model, scope, scopeKey]
  );

  if (result.rows.length === 0) return null;
  return mapStoredForecastRow(result.rows[0]);
};

export const generateAndStoreDemandForecast = async (
  model: ForecastModel,
  source: ForecastGenerationSource,
  productId?: string,
  orders?: ForecastOrder[]
): Promise<StoredForecastPayload> => {
  const effectiveOrders = orders || await fetchEligibleForecastOrders();
  const payload = await buildDemandForecastPayload(model, effectiveOrders, productId);
  await upsertStoredForecast(model, payload, source, productId);
  return (await getStoredDemandForecast(model, productId)) as StoredForecastPayload;
};

export const generateAndStoreAllDemandForecasts = async (
  source: ForecastGenerationSource
): Promise<GenerateAllForecastsSummary> => {
  if (activeGenerationPromise) {
    return activeGenerationPromise;
  }

  activeGenerationPromise = (async () => {
    const startedAt = new Date().toISOString();
    const orders = await fetchEligibleForecastOrders();
    const knownProductIds = await getExistingProductIds(getForecastableProductIds(orders));
    const productIds = Array.from(knownProductIds).sort();
    let generatedCount = 0;

    for (const model of FORECAST_MODELS) {
      await generateAndStoreDemandForecast(model, source, undefined, orders);
      generatedCount++;

      for (const productId of productIds) {
        await generateAndStoreDemandForecast(model, source, productId, orders);
        generatedCount++;
      }
    }

    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      generatedCount,
      productCount: productIds.length,
      models: FORECAST_MODELS,
      source
    };
  })();

  try {
    return await activeGenerationPromise;
  } finally {
    activeGenerationPromise = null;
  }
};
