-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_read BOOLEAN DEFAULT false,
  severity VARCHAR(10) DEFAULT 'low',
  recipient_id VARCHAR(50) NOT NULL,
  related_id VARCHAR(50)
);

-- System Logs
CREATE TABLE IF NOT EXISTS system_logs (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  actor_name VARCHAR(255) NOT NULL,
  actor_type VARCHAR(50) NOT NULL,
  action VARCHAR(255) NOT NULL,
  module VARCHAR(50) NOT NULL,
  details TEXT
);
