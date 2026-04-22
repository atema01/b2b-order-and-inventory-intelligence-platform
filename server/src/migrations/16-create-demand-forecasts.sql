CREATE TABLE IF NOT EXISTS demand_forecasts (
  id VARCHAR(50) PRIMARY KEY,
  model VARCHAR(30) NOT NULL,
  model_used VARCHAR(30) NOT NULL,
  forecast_scope VARCHAR(20) NOT NULL,
  scope_key VARCHAR(100) NOT NULL,
  product_id VARCHAR(50) REFERENCES products(id) ON DELETE CASCADE,
  time_resolution VARCHAR(10) NOT NULL,
  has_sufficient_data BOOLEAN NOT NULL DEFAULT false,
  message TEXT NOT NULL,
  chart_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  generation_source VARCHAR(20) NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_demand_forecasts_scope
ON demand_forecasts(model, forecast_scope, scope_key);

CREATE INDEX IF NOT EXISTS idx_demand_forecasts_product_model
ON demand_forecasts(product_id, model);

CREATE INDEX IF NOT EXISTS idx_demand_forecasts_generated_at
ON demand_forecasts(generated_at DESC);
