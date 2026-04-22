import { generateAndStoreAllDemandForecasts } from './demandForecastService';

const DEFAULT_SCHEDULE_DAY = 0;
const DEFAULT_SCHEDULE_HOUR = 2;
const DEFAULT_SCHEDULE_MINUTE = 0;

let schedulerTimer: NodeJS.Timeout | null = null;

const getScheduleNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getNextRunTime = (from: Date) => {
  const next = new Date(from);
  next.setHours(
    getScheduleNumber(process.env.FORECAST_SCHEDULE_HOUR, DEFAULT_SCHEDULE_HOUR),
    getScheduleNumber(process.env.FORECAST_SCHEDULE_MINUTE, DEFAULT_SCHEDULE_MINUTE),
    0,
    0
  );

  const targetDay = getScheduleNumber(process.env.FORECAST_SCHEDULE_DAY, DEFAULT_SCHEDULE_DAY);
  const daysUntilTarget = (targetDay - next.getDay() + 7) % 7;
  next.setDate(next.getDate() + daysUntilTarget);

  if (next <= from) {
    next.setDate(next.getDate() + 7);
  }

  return next;
};

const scheduleNextRun = () => {
  const now = new Date();
  const nextRun = getNextRunTime(now);
  const delay = Math.max(1000, nextRun.getTime() - now.getTime());

  console.log(`[ForecastScheduler] Next stored forecast generation: ${nextRun.toISOString()}`);

  schedulerTimer = setTimeout(async () => {
    try {
      console.log('[ForecastScheduler] Starting scheduled forecast generation');
      const summary = await generateAndStoreAllDemandForecasts('scheduled');
      console.log(
        `[ForecastScheduler] Stored ${summary.generatedCount} forecasts for ${summary.productCount} products`
      );
    } catch (err) {
      console.error('[ForecastScheduler] Scheduled forecast generation failed:', err);
    } finally {
      scheduleNextRun();
    }
  }, delay);
};

export const startForecastScheduler = () => {
  if (process.env.FORECAST_AUTO_GENERATE === 'false') {
    console.log('[ForecastScheduler] Automatic weekly forecast generation is disabled');
    return;
  }

  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
  }

  scheduleNextRun();
};
