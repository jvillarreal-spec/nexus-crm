-- MULTI-BOT SUPPORT MIGRATION

-- 1. Add Telegram columns to companies
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS telegram_token TEXT,
ADD COLUMN IF NOT EXISTS telegram_secret_token TEXT;

-- 2. Secure tokens (Only Super Admins can see raw tokens in general views, 
-- but Org Admins need access to their own for configuration)
-- RLS already handles company-level isolation.

-- 3. Add column to track which bot a message/conversation came from (Optional but good for tracking)
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS bot_username TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS bot_username TEXT;

-- 4. Initial update: assign the global token to the default company if needed
-- (User should do this manually via UI to avoid leaking env vars in migration files)
