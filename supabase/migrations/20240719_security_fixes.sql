-- Fix security issues identified by Supabase

-- 1. Fix function search path for get_merchant_stats
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
SET search_path = '' -- Fix: Set search path to empty string for security
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

-- 2. Add missing RLS policies for payments table
-- Note: Payments are created by webhooks (service role) but merchants should be able to view them
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Merchants can view payments for own tabs" ON public.payments;
DROP POLICY IF EXISTS "Public can view payments for payment confirmation" ON public.payments;

CREATE POLICY "Merchants can view payments for own tabs" 
ON public.payments FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.tabs 
        WHERE public.tabs.id = public.payments.tab_id 
        AND public.tabs.merchant_id = auth.uid()
    )
);

-- Public can view payments when viewing tabs (for payment confirmation)
CREATE POLICY "Public can view payments for payment confirmation" 
ON public.payments FOR SELECT 
USING (true);

-- 3. Add missing RLS policies for invoices table
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Merchants can view invoices for own tabs" ON public.invoices;
DROP POLICY IF EXISTS "Merchants can create invoices for own tabs" ON public.invoices;
DROP POLICY IF EXISTS "Merchants can update invoices for own tabs" ON public.invoices;
DROP POLICY IF EXISTS "Merchants can delete invoices for own tabs" ON public.invoices;

CREATE POLICY "Merchants can view invoices for own tabs" 
ON public.invoices FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.tabs 
        WHERE public.tabs.id = public.invoices.tab_id 
        AND public.tabs.merchant_id = auth.uid()
    )
);

CREATE POLICY "Merchants can create invoices for own tabs" 
ON public.invoices FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.tabs 
        WHERE public.tabs.id = public.invoices.tab_id 
        AND public.tabs.merchant_id = auth.uid()
    )
);

CREATE POLICY "Merchants can update invoices for own tabs" 
ON public.invoices FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.tabs 
        WHERE public.tabs.id = public.invoices.tab_id 
        AND public.tabs.merchant_id = auth.uid()
    )
);

CREATE POLICY "Merchants can delete invoices for own tabs" 
ON public.invoices FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.tabs 
        WHERE public.tabs.id = public.invoices.tab_id 
        AND public.tabs.merchant_id = auth.uid()
    )
);

-- Verify the fixes
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  -- Check payments policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE schemaname = 'public' AND tablename = 'payments';
  
  IF policy_count < 2 THEN
    RAISE WARNING 'Expected at least 2 policies on payments table, found %', policy_count;
  END IF;
  
  -- Check invoices policies  
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE schemaname = 'public' AND tablename = 'invoices';
  
  IF policy_count < 4 THEN
    RAISE WARNING 'Expected at least 4 policies on invoices table, found %', policy_count;
  END IF;
END $$;