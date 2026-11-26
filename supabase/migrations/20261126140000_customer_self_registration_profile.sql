-- Customer self-registration: create customer profiles only for explicit customer signups.
-- Public user metadata is used only to route a new account into the customer profile table.
-- Unknown/public signups do not receive an administrator profile or staff role.

CREATE OR REPLACE FUNCTION private.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF COALESCE(new.raw_user_meta_data ->> 'account_type', '') = 'customer' THEN
    INSERT INTO public.customer_profiles (id, full_name)
    VALUES (
      new.id,
      NULLIF(
        pg_catalog.btrim(
          COALESCE(new.raw_user_meta_data ->> 'full_name', '')
        ),
        ''
      )
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN new;
END;
$function$;
