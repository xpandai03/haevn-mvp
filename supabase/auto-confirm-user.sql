-- Auto-confirm the test user
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'raunek.pratap7@gmail.com';

-- Check the user's status
SELECT id, email, email_confirmed_at
FROM auth.users
WHERE email = 'raunek.pratap7@gmail.com';