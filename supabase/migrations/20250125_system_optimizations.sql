-- System-level optimizations to improve performance

-- 1. Create a materialized view for timezone names (rarely change)
-- This will cache the timezone data and avoid the slow system query
CREATE MATERIALIZED VIEW IF NOT EXISTS public.cached_timezones AS
SELECT name, abbrev, utc_offset, is_dst
FROM pg_timezone_names;

-- Create an index on the materialized view for fast lookups
CREATE INDEX IF NOT EXISTS idx_cached_timezones_name ON public.cached_timezones(name);

-- Function to refresh the materialized view (run periodically or after system updates)
CREATE OR REPLACE FUNCTION refresh_cached_timezones()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW public.cached_timezones;
END;
$$;

-- 2. Optimize the get_merchant_stats function with better query structure
DROP FUNCTION IF EXISTS get_merchant_stats();
CREATE OR REPLACE FUNCTION get_merchant_stats()
RETURNS TABLE (
  total_tabs bigint,
  open_tabs bigint,
  total_revenue numeric,
  pending_revenue numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  merchant_id uuid;
BEGIN
  -- Cache auth.uid() once
  merchant_id := (select auth.uid());
  
  RETURN QUERY
  WITH merchant_tabs AS (
    SELECT 
      t.id,
      t.status,
      t.total_amount,
      t.paid_amount
    FROM public.tabs t
    WHERE t.merchant_id = merchant_id
  )
  SELECT 
    COUNT(*)::bigint as total_tabs,
    COUNT(*) FILTER (WHERE status IN ('open', 'partial'))::bigint as open_tabs,
    COALESCE(SUM(paid_amount), 0) as total_revenue,
    COALESCE(SUM(total_amount - paid_amount) FILTER (WHERE status IN ('open', 'partial')), 0) as pending_revenue
  FROM merchant_tabs;
END;
$$;

-- 3. Add statistics target for frequently joined columns
-- This helps the query planner make better decisions
ALTER TABLE tabs ALTER COLUMN merchant_id SET STATISTICS 1000;
ALTER TABLE line_items ALTER COLUMN tab_id SET STATISTICS 1000;
ALTER TABLE payments ALTER COLUMN tab_id SET STATISTICS 1000;
ALTER TABLE api_keys ALTER COLUMN merchant_id SET STATISTICS 1000;

-- 4. Create a compound index for the most common join pattern
-- This helps when joining tabs with line_items and payments
CREATE INDEX IF NOT EXISTS idx_tabs_merchant_id_id ON tabs(merchant_id, id);

-- Update statistics
ANALYZE tabs;
ANALYZE line_items;
ANALYZE payments;
ANALYZE api_keys;