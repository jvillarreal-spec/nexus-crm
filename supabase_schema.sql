-- Enable Row Level Security (RLS) on all tables (best practice)
-- Create custom types
CREATE TYPE channel_type AS ENUM ('telegram', 'whatsapp');
CREATE TYPE conversation_status AS ENUM ('open', 'pending', 'resolved', 'closed');
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE message_content_type AS ENUM ('text', 'image', 'document', 'audio', 'video', 'location', 'sticker', 'contact');
CREATE TYPE deal_stage AS ENUM ('lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost');
CREATE TYPE user_role AS ENUM ('admin', 'agent', 'supervisor');

-- PROFILES (extends auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role user_role DEFAULT 'agent',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- CONTACTS
CREATE TABLE public.contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel channel_type NOT NULL,
  channel_id TEXT NOT NULL, -- chat_id or phone number
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  avatar_url TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  assigned_to UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel, channel_id)
);
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- CONVERSATIONS
CREATE TABLE public.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES public.contacts(id) NOT NULL,
  channel channel_type NOT NULL,
  assigned_to UUID REFERENCES public.profiles(id),
  status conversation_status DEFAULT 'open',
  unread_count INT DEFAULT 0,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  follow_up_at TIMESTAMPTZ, -- For 'pending' conversations
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- MESSAGES
CREATE TABLE public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) NOT NULL,
  channel_message_id TEXT, -- external ID
  direction message_direction NOT NULL,
  sender_type TEXT, -- 'customer', 'agent', 'bot'
  sender_id UUID REFERENCES public.profiles(id), -- Null if customer/bot
  content_type message_content_type DEFAULT 'text',
  body TEXT,
  media_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- DEALS
CREATE TABLE public.deals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES public.contacts(id) NOT NULL,
  title TEXT NOT NULL,
  value DECIMAL(12, 2) DEFAULT 0,
  currency TEXT DEFAULT 'COP',
  stage deal_stage DEFAULT 'lead',
  assigned_to UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- POLICIES (Simplified for MVP: Agents see everything for now)

-- Profiles: readable by authenticated users
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Contacts: readable by all agents
CREATE POLICY "Contacts viewable by agents" ON public.contacts FOR ALL USING (auth.role() = 'authenticated');

-- Conversations: readable by all agents
CREATE POLICY "Conversations viewable by agents" ON public.conversations FOR ALL USING (auth.role() = 'authenticated');

-- Messages: readable by all agents
CREATE POLICY "Messages viewable by agents" ON public.messages FOR ALL USING (auth.role() = 'authenticated');

-- Deals: readable by all agents
CREATE POLICY "Deals viewable by agents" ON public.deals FOR ALL USING (auth.role() = 'authenticated');


-- REALTIME SETUP
-- Enable Realtime for messages table to update Chat UI
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- TRIGGER FOR UPDATED_AT
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- TRIGGER TO CREATE PROFILE ON SIGNUP
-- This function is called by Supabase Auth (via trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
