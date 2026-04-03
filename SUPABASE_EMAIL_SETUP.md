# Supabase Email Confirmation Settings

**Issue:** User creation requires email confirmation by default in Supabase.

**Solution:** Disable email confirmation for faster user creation.

## Steps to Disable Email Confirmation:

1. **Go to Supabase Dashboard:** https://supabase.com/dashboard
2. **Select your project:** CareLink HMS
3. **Navigate to:** Authentication → Settings → Email Auth
4. **Find:** "Enable email confirmations"
5. **Toggle OFF:** Disable this setting
6. **Save changes**

## Alternative: Manual Confirmation

If you want to keep email confirmations ON:

1. Check the email inbox for newly created users
2. Click the confirmation link
3. User can then login

## For Development/Testing:

It's recommended to **disable email confirmations** during development for easier testing.

## Security Note:

For production, you may want to enable email confirmations to prevent unauthorized account creation. However, since CareLink is for internal hospital use (admin creates all users), email confirmation is not necessary.
