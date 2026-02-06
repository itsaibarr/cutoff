-- Secure Pairing Function
CREATE OR REPLACE FUNCTION verify_pairing_code(input_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  found_id UUID;
BEGIN
  SELECT id INTO found_id
  FROM public.profiles
  WHERE pairing_code = input_code
  LIMIT 1;

  RETURN found_id;
END;
$$;
