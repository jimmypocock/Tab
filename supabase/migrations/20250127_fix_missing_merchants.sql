-- Fix missing merchant records for existing users
-- This can happen if users were created before the merchant trigger

-- Create merchants for any auth users that don't have one
INSERT INTO merchants (id, email, business_name)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'business_name', 'My Business')
FROM auth.users au
LEFT JOIN merchants m ON m.id = au.id
WHERE m.id IS NULL;

-- Also ensure the trigger function has the correct search path
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger 
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.merchants (id, email, business_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'business_name', 'My Business')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();