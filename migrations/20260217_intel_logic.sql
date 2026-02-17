-- NEXUS INTELLIGENCE: ROUND ROBBIN & SLA LOGIC

-- 1. Get Agent Load (for Round Robin)
CREATE OR REPLACE FUNCTION public.get_agent_load(org_id UUID)
RETURNS TABLE (agent_id UUID, open_chats BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as agent_id,
        COUNT(c.id) as open_chats
    FROM 
        public.profiles p
    LEFT JOIN 
        public.conversations c ON c.assigned_to = p.id AND c.status = 'open'
    WHERE 
        p.company_id = org_id
        AND p.role = 'agent'
    GROUP BY 
        p.id
    ORDER BY 
        open_chats ASC, p.id ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Mark SLA Breaches (Optional background logic, can also be done in FE)
-- For now, let's allow the FE to calculate it for real-time responsiveness.
-- But we can add a view for Admins.

CREATE OR REPLACE VIEW public.unanswered_conversations AS
SELECT 
    c.*,
    EXTRACT(EPOCH FROM (NOW() - c.last_message_at)) / 60 as minutes_waiting
FROM 
    public.conversations c
WHERE 
    c.status = 'open'
    AND EXISTS (
        SELECT 1 FROM public.messages m 
        WHERE m.conversation_id = c.id 
        AND m.direction = 'inbound'
        ORDER BY m.created_at DESC 
        LIMIT 1
    );
