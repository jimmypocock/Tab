-- Fix function search path issue definitively

-- Drop all versions of the function
DROP FUNCTION IF EXISTS get_merchant_stats();
DROP FUNCTION IF EXISTS get_merchant_stats(uuid);

-- Recreate with proper search path
CREATE OR REPLACE FUNCTION get_merchant_stats()
RETURNS TABLE (
  total_tabs bigint,
  open_tabs bigint,
  total_revenue numeric,
  pending_revenue numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''  -- Set to empty string as recommended by Supabase security advisor
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT t.id) as total_tabs,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status IN ('open', 'partial')) as open_tabs,
    COALESCE(SUM(DISTINCT t.paid_amount), 0) as total_revenue,
    COALESCE(SUM(DISTINCT t.total_amount - t.paid_amount) FILTER (WHERE t.status IN ('open', 'partial')), 0) as pending_revenue
  FROM public.tabs t
  WHERE t.merchant_id = auth.uid();
END;
$$;

-- Grant appropriate permissions
GRANT EXECUTE ON FUNCTION get_merchant_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_merchant_stats() TO service_role;