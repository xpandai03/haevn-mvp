-- Test query to verify if the onboarding state tables are set up correctly
-- Run this after running FIX_ONBOARDING_STATE.sql

-- Check if user_onboarding_state table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'user_onboarding_state'
) AS user_onboarding_state_exists;

-- Check if user_survey_responses table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'user_survey_responses'
) AS user_survey_responses_exists;

-- Show current users and their onboarding state (if any)
SELECT
    u.id,
    u.email,
    os.current_step,
    os.identity_completed,
    os.survey_completed,
    os.membership_selected,
    sr.completion_pct as survey_completion
FROM auth.users u
LEFT JOIN user_onboarding_state os ON u.id = os.user_id
LEFT JOIN user_survey_responses sr ON u.id = sr.user_id
ORDER BY u.created_at DESC
LIMIT 10;

-- Show success message
SELECT 'If you see your user data above, the tables are working correctly!' as message;