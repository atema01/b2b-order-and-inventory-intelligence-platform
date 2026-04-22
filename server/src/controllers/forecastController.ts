import { Request, Response } from 'express';
import {
  ForecastModel,
  generateAndStoreAllDemandForecasts,
  generateAndStoreDemandForecast,
  getStoredDemandForecast
} from '../services/demandForecastService';

const getParam = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
};

const getRequestedModel = (value: string): ForecastModel =>
  value === 'fb-prophet' ? 'fb-prophet' : 'holt-winters';

export const getDemandForecastMetrics = async (req: Request, res: Response) => {
  const productId = getParam(req.query.productId as string | string[] | undefined);
  const model = getRequestedModel(getParam(req.query.model as string | string[] | undefined));

  try {
    const storedForecast = await getStoredDemandForecast(model, productId || undefined);
    if (storedForecast) {
      return res.json(storedForecast);
    }

    return res.json(
      await generateAndStoreDemandForecast(model, 'on-demand', productId || undefined)
    );
  } catch (err) {
    console.error('Get demand forecast metrics error:', err);
    return res.status(500).json({ error: 'Failed to fetch demand forecast metrics' });
  }
};

export const generateDemandForecasts = async (req: Request, res: Response) => {
  const userRole = (req as any).user?.role;

  if (userRole === 'R-BUYER') {
    return res.status(403).json({ error: 'Buyers cannot generate platform forecasts.' });
  }

  try {
    const summary = await generateAndStoreAllDemandForecasts('manual');
    return res.json({
      message: `Generated ${summary.generatedCount} stored forecasts across ${summary.models.length} models.`,
      ...summary
    });
  } catch (err) {
    console.error('Generate demand forecasts error:', err);
    return res.status(500).json({ error: 'Failed to generate demand forecasts' });
  }
};
