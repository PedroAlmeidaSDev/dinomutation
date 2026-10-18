-- Hosted Postgres such as Supabase exposes the public schema through a REST API with a public key.
-- RLS without policies denies every row to those roles; the API connects as the table owner and
-- is not affected. New tables need the same line.
ALTER TABLE player ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_token ENABLE ROW LEVEL SECURITY;
ALTER TABLE run ENABLE ROW LEVEL SECURITY;
ALTER TABLE dino_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_level ENABLE ROW LEVEL SECURITY;
ALTER TABLE flyway_schema_history ENABLE ROW LEVEL SECURITY;
