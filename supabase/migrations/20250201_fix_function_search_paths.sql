-- Fix security warnings: Set search_path to empty string for all functions
-- This prevents search_path injection attacks

-- Fix update_merchant_processors_updated_at function
CREATE OR REPLACE FUNCTION public.update_merchant_processors_updated_at()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.merchants (id, email, business_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'business_name', 'Unnamed Business')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;