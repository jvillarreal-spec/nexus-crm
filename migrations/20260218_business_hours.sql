-- Add business_hours and timezone for company configuration
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{
    "monday": {"start": "09:00", "end": "18:00", "enabled": true},
    "tuesday": {"start": "09:00", "end": "18:00", "enabled": true},
    "wednesday": {"start": "09:00", "end": "18:00", "enabled": true},
    "thursday": {"start": "09:00", "end": "18:00", "enabled": true},
    "friday": {"start": "09:00", "end": "18:00", "enabled": true},
    "saturday": {"start": "09:00", "end": "13:00", "enabled": true},
    "sunday": {"enabled": false}
}',
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Bogota';

-- Add helper function to check if business is open
CREATE OR REPLACE FUNCTION public.is_business_open(company_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    hours JSONB;
    tz TEXT;
    now_local TIMESTAMP;
    day_key TEXT;
    day_config JSONB;
    start_time TIME;
    end_time TIME;
BEGIN
    SELECT business_hours, timezone INTO hours, tz
    FROM public.companies
    WHERE id = company_id;

    IF hours IS NULL OR tz IS NULL THEN
        RETURN TRUE; -- Default to open if no config
    END IF;

    -- Get current time in company timezone
    now_local := NOW() AT TIME ZONE 'UTC' AT TIME ZONE tz;
    
    -- Get day of week (monday, tuesday...)
    day_key := lower(trim(to_char(now_local, 'Day')));
    
    day_config := hours->day_key;

    -- check if day exists and is enabled
    IF day_config IS NULL OR (day_config->>'enabled')::boolean = false THEN
        RETURN FALSE;
    END IF;

    start_time := (day_config->>'start')::TIME;
    end_time := (day_config->>'end')::TIME;

    IF now_local::TIME >= start_time AND now_local::TIME <= end_time THEN
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RETURN TRUE; -- Fail open
END;
$$ LANGUAGE plpgsql;
