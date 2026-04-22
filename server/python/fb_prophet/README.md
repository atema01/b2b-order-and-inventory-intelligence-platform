FB Prophet integration files for server-side forecasting.

Setup:

1. Install Python 3.10+.
2. Install dependencies:
   pip install -r server/python/fb_prophet/requirements.txt

Optional:

- The server will try `python`, then `py -3`, then `python3`.
- Set `PROPHET_PYTHON_PATH` if your Python executable lives elsewhere.

Forecast automation:

- Weekly stored forecast generation is enabled by default on server startup.
- Optional server env vars:
  - `FORECAST_AUTO_GENERATE=true`
  - `FORECAST_SCHEDULE_DAY=0` for Sunday
  - `FORECAST_SCHEDULE_HOUR=2`
  - `FORECAST_SCHEDULE_MINUTE=0`
- You can also trigger a full refresh manually from the Reports page or via `POST /api/orders/metrics/demand-forecast/generate`.
