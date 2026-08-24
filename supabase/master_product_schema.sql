-- ============================================================
-- OUR UNIVERSE v2 — MASTER PRODUCTION MULTI-TENANT SCHEMA
-- ============================================================
-- Production-ready, multi-tenant database schema for Our Universe v2.
-- Incorporates airtight RLS policies, compound foreign keys, message
-- immutability triggers, secure invitation redemption, star progress
-- validation, dual-bound storage security, and Supabase Realtime RLS.
-- ============================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- 2. CORE TABLES
-- ------------------------------------------------------------

-- PROFILES (Extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- UNIVERSES (Multi-tenant experience container)
CREATE TABLE IF NOT EXISTS public.universes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL DEFAULT 'OUR UNIVERSE',
    subtitle TEXT DEFAULT 'A private digital experience',
    description TEXT,
    theme_config JSONB NOT NULL DEFAULT '{
        "colorPalette": "cosmic_dark",
        "starGlowColor": "#ffffff",
        "backgroundNebula": true
    }'::jsonb,
    star_count INT NOT NULL DEFAULT 12,
    has_secret_star BOOLEAN NOT NULL DEFAULT true,
    is_private BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_universes_owner ON public.universes(owner_id);
CREATE INDEX IF NOT EXISTS idx_universes_slug ON public.universes(slug);

-- UNIVERSE MEMBERSHIPS
CREATE TABLE IF NOT EXISTS public.universe_members (
    universe_id UUID NOT NULL REFERENCES public.universes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'traveler', 'guest')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (universe_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_universe_members_user ON public.universe_members(user_id);

-- UNIVERSE INVITATIONS (Hashed UUID tokens)
CREATE TABLE IF NOT EXISTS public.universe_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    universe_id UUID NOT NULL REFERENCES public.universes(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    assigned_role TEXT NOT NULL DEFAULT 'traveler' CHECK (assigned_role IN ('admin', 'traveler', 'guest')),
    max_uses INT DEFAULT NULL,
    uses_count INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_universe ON public.universe_invitations(universe_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.universe_invitations(token_hash);

-- 3D STARS / CELESTIAL NODES
CREATE TABLE IF NOT EXISTS public.stars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    universe_id UUID NOT NULL REFERENCES public.universes(id) ON DELETE CASCADE,
    star_number INT NOT NULL,
    name TEXT NOT NULL,
    subtitle TEXT,
    description TEXT,
    position_x FLOAT NOT NULL DEFAULT 0.0,
    position_y FLOAT NOT NULL DEFAULT 0.0,
    position_z FLOAT NOT NULL DEFAULT 0.0,
    is_secret_star BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_universe_star_number UNIQUE (universe_id, star_number)
);

CREATE INDEX IF NOT EXISTS idx_stars_universe ON public.stars(universe_id);

-- MEMORIES & NARRATIVE CONTENT (Compound PK for Media Asset Binding)
CREATE TABLE IF NOT EXISTS public.memories (
    id UUID DEFAULT gen_random_uuid(),
    universe_id UUID NOT NULL REFERENCES public.universes(id) ON DELETE CASCADE,
    star_id UUID REFERENCES public.stars(id) ON DELETE SET NULL,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    memory_date DATE,
    location_name TEXT,
    display_order INT NOT NULL DEFAULT 0,
    is_unlocked_by_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, universe_id)
);

CREATE INDEX IF NOT EXISTS idx_memories_universe ON public.memories(universe_id);
CREATE INDEX IF NOT EXISTS idx_memories_star ON public.memories(star_id);

-- STORIES & NARRATIVE SEQUENCES (Compound PK for Story Memories Binding)
CREATE TABLE IF NOT EXISTS public.stories (
    id UUID DEFAULT gen_random_uuid(),
    universe_id UUID NOT NULL REFERENCES public.universes(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, universe_id)
);

CREATE INDEX IF NOT EXISTS idx_stories_universe ON public.stories(universe_id);

-- STORY MEMORIES (Relational Join Table preventing Cross-Universe References)
CREATE TABLE IF NOT EXISTS public.story_memories (
    story_id UUID NOT NULL,
    memory_id UUID NOT NULL,
    universe_id UUID NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (story_id, memory_id),
    FOREIGN KEY (story_id, universe_id) REFERENCES public.stories(id, universe_id) ON DELETE CASCADE,
    FOREIGN KEY (memory_id, universe_id) REFERENCES public.memories(id, universe_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_story_memories_story ON public.story_memories(story_id);
CREATE INDEX IF NOT EXISTS idx_story_memories_memory ON public.story_memories(memory_id);

-- MEDIA ASSETS (Metadata pointers bound via Compound FK to Memories)
CREATE TABLE IF NOT EXISTS public.media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    universe_id UUID NOT NULL REFERENCES public.universes(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    memory_id UUID,
    storage_path TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'audio', 'video', 'document')),
    mime_type TEXT,
    file_size_bytes BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (memory_id, universe_id) REFERENCES public.memories(id, universe_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_media_universe ON public.media_assets(universe_id);
CREATE INDEX IF NOT EXISTS idx_media_memory ON public.media_assets(memory_id);

-- CONVERSATIONS & MESSAGES (Compound FK Data Isolation)
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID DEFAULT gen_random_uuid(),
    universe_id UUID NOT NULL REFERENCES public.universes(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'General',
    is_private BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, universe_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    universe_id UUID NOT NULL,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'system')),
    media_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
    reply_to_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    is_edited BOOLEAN NOT NULL DEFAULT false,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (conversation_id, universe_id) REFERENCES public.conversations(id, universe_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_universe ON public.messages(universe_id);

-- WEBRTC CALL SESSIONS & PARTICIPANTS (Compound FK Data Isolation)
CREATE TABLE IF NOT EXISTS public.call_sessions (
    id UUID DEFAULT gen_random_uuid(),
    universe_id UUID NOT NULL REFERENCES public.universes(id) ON DELETE CASCADE,
    host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    call_type TEXT NOT NULL CHECK (call_type IN ('audio', 'video')),
    status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'ringing', 'connected', 'ended', 'declined', 'missed')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    duration_seconds INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id, universe_id)
);

CREATE TABLE IF NOT EXISTS public.call_participants (
    call_session_id UUID NOT NULL,
    universe_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at TIMESTAMPTZ,
    PRIMARY KEY (call_session_id, user_id),
    FOREIGN KEY (call_session_id, universe_id) REFERENCES public.call_sessions(id, universe_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_call_sessions_universe ON public.call_sessions(universe_id);

-- PER-USER UNIVERSE PROGRESS
CREATE TABLE IF NOT EXISTS public.user_universe_progress (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    universe_id UUID NOT NULL REFERENCES public.universes(id) ON DELETE CASCADE,
    discovered_star_ids UUID[] NOT NULL DEFAULT '{}',
    is_experience_completed BOOLEAN NOT NULL DEFAULT false,
    is_star_13_unlocked BOOLEAN NOT NULL DEFAULT false,
    is_hidden_game_completed BOOLEAN NOT NULL DEFAULT false,
    last_visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, universe_id)
);

CREATE INDEX IF NOT EXISTS idx_user_progress_user ON public.user_universe_progress(user_id);

-- ------------------------------------------------------------
-- 3. SECURITY DEFINER HELPER FUNCTIONS & TRIGGERS
-- ------------------------------------------------------------

-- Automated Profile Creation Trigger on Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, username, display_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
        COALESCE(NEW.raw_user_meta_data->>'display_name', 'Cosmic Traveler'),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-assign Owner Membership & Seed Default Content on Universe Creation
CREATE OR REPLACE FUNCTION public.handle_universe_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_star_id UUID;
    v_memory_id UUID;
    v_story_id UUID;
    v_memory_ids UUID[] := '{}';
    v_star_rec RECORD;
    v_stars_data CONSTANT JSONB := '[
        {"num": 1, "name": "First Light", "sub": "Cosmic Beginning", "descr": "A glowing star marking the initial spark of our shared universe.", "x": -8.0, "y": 5.0, "z": -25.0},
        {"num": 2, "name": "Cosmic Whisper", "sub": "Starlight Phase", "descr": "Echoes of quiet conversations drifting across space.", "x": 12.0, "y": -4.0, "z": -35.0},
        {"num": 3, "name": "Starlight Promises", "sub": "Nebula Phase", "descr": "Bright points of light bound together into an unforgettable pattern.", "x": -15.0, "y": -8.0, "z": -45.0},
        {"num": 4, "name": "Deep Nebula", "sub": "Luminous Phase", "descr": "A vibrant cloud of cosmic dust radiating warmth and magic.", "x": 6.0, "y": 14.0, "z": -55.0},
        {"num": 5, "name": "Orbit of Us", "sub": "Gravitational Phase", "descr": "Two paths curving around each other in gravitational harmony.", "x": -22.0, "y": 10.0, "z": -65.0},
        {"num": 6, "name": "Time Capsule", "sub": "Stasis Phase", "descr": "A preserved moment suspended in timeless crystal energy.", "x": 18.0, "y": 12.0, "z": -75.0},
        {"num": 7, "name": "Midnight Rain", "sub": "Atmospheric Phase", "descr": "Gentle melodies falling like starlight on a quiet night.", "x": -10.0, "y": -18.0, "z": -85.0},
        {"num": 8, "name": "Eternal Echoes", "sub": "Singularity Phase", "descr": "A gateway leading into deeper layers of cosmic memory.", "x": 25.0, "y": -12.0, "z": -95.0},
        {"num": 9, "name": "Solemn Constellation", "sub": "Reflection Phase", "descr": "A serene star reflecting deep thoughts and quiet moments.", "x": -5.0, "y": 22.0, "z": -105.0},
        {"num": 10, "name": "Celestial Convergence", "sub": "Alignment Phase", "descr": "Multiple lines of light converging into a single brilliant beacon.", "x": 15.0, "y": -25.0, "z": -115.0},
        {"num": 11, "name": "Cosmic Horizon", "sub": "Expansion Phase", "descr": "Looking outward toward endless possibilities beyond the edge.", "x": -28.0, "y": -6.0, "z": -125.0},
        {"num": 12, "name": "The Final Star", "sub": "Radiant Phase", "descr": "The 12th star completed — unlocking the central core of the Universe.", "x": 0.0, "y": 0.0, "z": -135.0}
    ]'::jsonb;
BEGIN
    -- 1. Owner Membership Assignment
    INSERT INTO public.universe_members (universe_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'owner')
    ON CONFLICT (universe_id, user_id) DO UPDATE SET role = 'owner';

    -- 2. Default General Conversation
    INSERT INTO public.conversations (universe_id, title, is_private)
    VALUES (NEW.id, 'General', false);

    -- 3. Initialize Owner Progress
    INSERT INTO public.user_universe_progress (user_id, universe_id)
    VALUES (NEW.owner_id, NEW.id)
    ON CONFLICT (user_id, universe_id) DO NOTHING;

    -- 4. Seed Default 12 Stars and 12 Memories
    FOR v_star_rec IN SELECT * FROM jsonb_to_recordset(v_stars_data) AS x(num INT, name TEXT, sub TEXT, descr TEXT, x FLOAT, y FLOAT, z FLOAT)
    LOOP
        v_star_id := gen_random_uuid();
        v_memory_id := gen_random_uuid();

        -- Insert Star Node
        INSERT INTO public.stars (
            id, universe_id, star_number, name, subtitle, description,
            position_x, position_y, position_z, is_secret_star
        ) VALUES (
            v_star_id, NEW.id, v_star_rec.num, v_star_rec.name, v_star_rec.sub, v_star_rec.descr,
            v_star_rec.x, v_star_rec.y, v_star_rec.z, false
        ) ON CONFLICT (universe_id, star_number) DO NOTHING;

        -- Insert Memory Record
        INSERT INTO public.memories (
            id, universe_id, star_id, author_id, title, content,
            location_name, display_order, is_unlocked_by_default
        ) VALUES (
            v_memory_id, NEW.id, v_star_id, NEW.owner_id, v_star_rec.name, v_star_rec.descr,
            v_star_rec.sub, v_star_rec.num - 1, (v_star_rec.num <= 2)
        ) ON CONFLICT (id, universe_id) DO NOTHING;

        v_memory_ids := array_append(v_memory_ids, v_memory_id);
    END LOOP;

    -- 5. Seed Default Story Sequence
    v_story_id := gen_random_uuid();
    INSERT INTO public.stories (id, universe_id, title, description)
    VALUES (
        v_story_id,
        NEW.id,
        'Our Universe',
        E'In a infinite sea of noise, stars align to form a single connection...\nEvery star holds a memory, waiting to be rediscovered.\nWelcome to Our Universe.'
    ) ON CONFLICT (id, universe_id) DO NOTHING;

    -- 6. Seed Story Memories Relational Join
    FOR i IN 1..cardinality(v_memory_ids) LOOP
        INSERT INTO public.story_memories (
            story_id, memory_id, universe_id, display_order
        ) VALUES (
            v_story_id, v_memory_ids[i], NEW.id, i - 1
        ) ON CONFLICT (story_id, memory_id) DO NOTHING;
    END LOOP;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_universe_created ON public.universes;
CREATE TRIGGER on_universe_created
    AFTER INSERT ON public.universes
    FOR EACH ROW EXECUTE FUNCTION public.handle_universe_created();

-- Message Immutability Trigger (Prevents changing sender_id, universe_id, conversation_id, or created_at)
CREATE OR REPLACE FUNCTION public.enforce_message_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.sender_id <> OLD.sender_id THEN
        RAISE EXCEPTION 'ImmutableFieldViolation: sender_id cannot be modified.';
    END IF;
    IF NEW.universe_id <> OLD.universe_id THEN
        RAISE EXCEPTION 'ImmutableFieldViolation: universe_id cannot be modified.';
    END IF;
    IF NEW.conversation_id <> OLD.conversation_id THEN
        RAISE EXCEPTION 'ImmutableFieldViolation: conversation_id cannot be modified.';
    END IF;
    IF NEW.created_at <> OLD.created_at THEN
        RAISE EXCEPTION 'ImmutableFieldViolation: created_at cannot be modified.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_message_immutability ON public.messages;
CREATE TRIGGER trg_enforce_message_immutability
    BEFORE UPDATE ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.enforce_message_immutability();

-- User Progress Star Validation Trigger (Ensures all discovered stars belong to the target universe)
CREATE OR REPLACE FUNCTION public.validate_user_progress_stars()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invalid_star_count INT;
BEGIN
    IF NEW.discovered_star_ids IS NOT NULL AND cardinality(NEW.discovered_star_ids) > 0 THEN
        SELECT COUNT(*) INTO v_invalid_star_count
        FROM unnest(NEW.discovered_star_ids) AS sid
        WHERE NOT EXISTS (
            SELECT 1 FROM public.stars
            WHERE id = sid AND universe_id = NEW.universe_id
        );

        IF v_invalid_star_count > 0 THEN
            RAISE EXCEPTION 'StarProgressViolation: discovered_star_ids contains star IDs that do not belong to universe %', NEW.universe_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_user_progress_stars ON public.user_universe_progress;
CREATE TRIGGER trg_validate_user_progress_stars
    BEFORE INSERT OR UPDATE ON public.user_universe_progress
    FOR EACH ROW EXECUTE FUNCTION public.validate_user_progress_stars();

-- RLS Helper Functions
CREATE OR REPLACE FUNCTION public.can_read_universe(p_universe_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.universes
        WHERE id = p_universe_id AND (is_private = false OR owner_id = p_user_id)
    ) OR EXISTS (
        SELECT 1 FROM public.universe_members
        WHERE universe_id = p_universe_id AND user_id = p_user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.can_write_universe(p_universe_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.universes
        WHERE id = p_universe_id AND owner_id = p_user_id
    ) OR EXISTS (
        SELECT 1 FROM public.universe_members
        WHERE universe_id = p_universe_id AND user_id = p_user_id AND role IN ('owner', 'admin', 'traveler')
    );
$$;

CREATE OR REPLACE FUNCTION public.is_universe_admin(p_universe_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.universes
        WHERE id = p_universe_id AND owner_id = p_user_id
    ) OR EXISTS (
        SELECT 1 FROM public.universe_members
        WHERE universe_id = p_universe_id AND user_id = p_user_id AND role IN ('owner', 'admin')
    );
$$;

CREATE OR REPLACE FUNCTION public.is_universe_owner(p_universe_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.universes
        WHERE id = p_universe_id AND owner_id = p_user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.shares_universe(p_user_id_1 UUID, p_user_id_2 UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.universe_members m1
        JOIN public.universe_members m2 ON m1.universe_id = m2.universe_id
        WHERE m1.user_id = p_user_id_1 AND m2.user_id = p_user_id_2
    );
$$;

-- Dual-Bound Storage Security Helper Functions
CREATE OR REPLACE FUNCTION public.can_read_storage_asset(p_universe_id UUID, p_memory_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.can_read_universe(p_universe_id, p_user_id)
    AND (
        p_memory_id IS NULL
        OR EXISTS (
            SELECT 1 FROM public.memories
            WHERE id = p_memory_id AND universe_id = p_universe_id
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_write_storage_asset(p_universe_id UUID, p_memory_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.can_write_universe(p_universe_id, p_user_id)
    AND (
        p_memory_id IS NULL
        OR EXISTS (
            SELECT 1 FROM public.memories
            WHERE id = p_memory_id AND universe_id = p_universe_id
        )
    );
$$;

-- ------------------------------------------------------------
-- 4. SECURE INVITATION GENERATION & REDEMPTION RPCs
-- ------------------------------------------------------------

-- Admin RPC: Generate a cryptographically random UUID token link
CREATE OR REPLACE FUNCTION public.create_universe_invitation(
    p_universe_id UUID,
    p_assigned_role TEXT DEFAULT 'traveler',
    p_max_uses INT DEFAULT NULL,
    p_expires_in_hours INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_raw_token TEXT;
    v_token_hash TEXT;
    v_expires_at TIMESTAMPTZ;
    v_invitation_id UUID;
BEGIN
    -- Authorization Check
    IF NOT public.is_universe_admin(p_universe_id, auth.uid()) THEN
        RAISE EXCEPTION 'Permission denied: Universe admin access required.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF p_assigned_role NOT IN ('admin', 'traveler', 'guest') THEN
        RAISE EXCEPTION 'Invalid assigned role: must be admin, traveler, or guest.';
    END IF;

    -- Generate random token & SHA-256 hash using extensions.digest()
    v_raw_token := gen_random_uuid()::text;
    v_token_hash := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');

    IF p_expires_in_hours IS NOT NULL THEN
        v_expires_at := now() + (p_expires_in_hours || ' hours')::interval;
    END IF;

    INSERT INTO public.universe_invitations (
        universe_id,
        created_by,
        token_hash,
        assigned_role,
        max_uses,
        expires_at
    ) VALUES (
        p_universe_id,
        auth.uid(),
        v_token_hash,
        p_assigned_role,
        p_max_uses,
        v_expires_at
    ) RETURNING id INTO v_invitation_id;

    RETURN jsonb_build_object(
        'invitation_id', v_invitation_id,
        'universe_id', p_universe_id,
        'raw_token', v_raw_token,
        'assigned_role', p_assigned_role,
        'expires_at', v_expires_at
    );
END;
$$;

-- User RPC: Redeem an invitation token atomically without role downgrade vulnerability
CREATE OR REPLACE FUNCTION public.redeem_universe_invitation(p_raw_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target_hash TEXT;
    v_invitation RECORD;
    v_caller_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to redeem invitations.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF p_raw_token IS NULL OR trim(p_raw_token) = '' THEN
        RAISE EXCEPTION 'Invalid token.';
    END IF;

    -- Compute SHA-256 hash of provided token using extensions.digest()
    v_target_hash := encode(extensions.digest(trim(p_raw_token), 'sha256'), 'hex');

    -- Lookup invitation with FOR UPDATE row lock to prevent race conditions
    SELECT * INTO v_invitation
    FROM public.universe_invitations
    WHERE token_hash = v_target_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_INVITATION_TOKEN: The invitation link is invalid.';
    END IF;

    -- Expiration Check
    IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at <= now() THEN
        RAISE EXCEPTION 'EXPIRED_INVITATION: This invitation link has expired.';
    END IF;

    -- Usage Limit Check
    IF v_invitation.max_uses IS NOT NULL AND v_invitation.uses_count >= v_invitation.max_uses THEN
        RAISE EXCEPTION 'INVITATION_LIMIT_REACHED: This invitation link has reached its maximum usage limit.';
    END IF;

    -- Existing Member Check (Prevents role downgrade or re-redemption)
    IF EXISTS (
        SELECT 1 FROM public.universe_members
        WHERE universe_id = v_invitation.universe_id AND user_id = v_caller_id
    ) THEN
        RAISE EXCEPTION 'ALREADY_MEMBER: You are already a member of this universe.'
            USING ERRCODE = 'unique_violation';
    END IF;

    -- Increment usage counter
    UPDATE public.universe_invitations
    SET uses_count = uses_count + 1
    WHERE id = v_invitation.id;

    -- Add user to universe_members with assigned role (No DO UPDATE to prevent role tampering)
    INSERT INTO public.universe_members (universe_id, user_id, role)
    VALUES (v_invitation.universe_id, v_caller_id, v_invitation.assigned_role);

    -- Initialize user progress row
    INSERT INTO public.user_universe_progress (user_id, universe_id)
    VALUES (v_caller_id, v_invitation.universe_id)
    ON CONFLICT (user_id, universe_id) DO NOTHING;

    RETURN jsonb_build_object(
        'success', true,
        'universe_id', v_invitation.universe_id,
        'assigned_role', v_invitation.assigned_role
    );
END;
$$;

-- Secure Progress Recording RPC (Validates star belongs to universe database-side)
CREATE OR REPLACE FUNCTION public.record_star_discovery(
    p_universe_id UUID,
    p_star_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_star_exists BOOLEAN;
    v_total_required INT;
    v_discovered_count INT;
    v_current_stars UUID[];
    v_new_stars UUID[];
    v_is_completed BOOLEAN;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF NOT public.can_read_universe(p_universe_id, v_caller_id) THEN
        RAISE EXCEPTION 'Permission denied: Cannot access universe.' USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Database-side check: verify star actually belongs to the target universe
    SELECT EXISTS (
        SELECT 1 FROM public.stars WHERE id = p_star_id AND universe_id = p_universe_id
    ) INTO v_star_exists;

    IF NOT v_star_exists THEN
        RAISE EXCEPTION 'InvalidStar: Star does not belong to the target universe.';
    END IF;

    SELECT star_count INTO v_total_required FROM public.universes WHERE id = p_universe_id;

    SELECT discovered_star_ids INTO v_current_stars
    FROM public.user_universe_progress
    WHERE user_id = v_caller_id AND universe_id = p_universe_id;

    IF v_current_stars IS NULL THEN
        v_current_stars := '{}';
    END IF;

    IF NOT (p_star_id = ANY(v_current_stars)) THEN
        v_new_stars := array_append(v_current_stars, p_star_id);
    ELSE
        v_new_stars := v_current_stars;
    END IF;

    v_discovered_count := cardinality(v_new_stars);
    v_is_completed := v_discovered_count >= COALESCE(v_total_required, 12);

    INSERT INTO public.user_universe_progress (
        user_id, universe_id, discovered_star_ids, is_experience_completed, updated_at
    ) VALUES (
        v_caller_id, p_universe_id, v_new_stars, v_is_completed, now()
    )
    ON CONFLICT (user_id, universe_id) DO UPDATE SET
        discovered_star_ids = EXCLUDED.discovered_star_ids,
        is_experience_completed = (user_universe_progress.is_experience_completed OR EXCLUDED.is_experience_completed),
        updated_at = now();

    RETURN jsonb_build_object(
        'success', true,
        'discovered_count', v_discovered_count,
        'is_completed', v_is_completed
    );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.create_universe_invitation(UUID, TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_universe_invitation(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_star_discovery(UUID, UUID) TO authenticated;

-- ------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universe_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universe_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_universe_progress ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
CREATE POLICY "Profiles select co_member_or_self" ON public.profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid() OR public.shares_universe(id, auth.uid()));

DROP POLICY IF EXISTS "Profiles insert self" ON public.profiles;
CREATE POLICY "Profiles insert self" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

CREATE POLICY "Profiles update self" ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- UNIVERSES POLICIES
CREATE POLICY "Universes select" ON public.universes
    FOR SELECT TO authenticated
    USING (public.can_read_universe(id, auth.uid()));

DROP POLICY IF EXISTS "Universes insert owner" ON public.universes;
DROP POLICY IF EXISTS "Universes insert" ON public.universes;

CREATE POLICY "Universes insert owner" ON public.universes
    FOR INSERT TO authenticated
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Universes update admin" ON public.universes
    FOR UPDATE TO authenticated
    USING (public.is_universe_admin(id, auth.uid()))
    WITH CHECK (public.is_universe_admin(id, auth.uid()));

CREATE POLICY "Universes delete owner" ON public.universes
    FOR DELETE TO authenticated
    USING (owner_id = auth.uid());

-- UNIVERSE MEMBERS POLICIES
CREATE POLICY "Members select" ON public.universe_members
    FOR SELECT TO authenticated
    USING (public.can_read_universe(universe_id, auth.uid()));

CREATE POLICY "Members update owner" ON public.universe_members
    FOR UPDATE TO authenticated
    USING (public.is_universe_owner(universe_id, auth.uid()))
    WITH CHECK (public.is_universe_owner(universe_id, auth.uid()));

CREATE POLICY "Members delete admin_or_self" ON public.universe_members
    FOR DELETE TO authenticated
    USING (public.is_universe_admin(universe_id, auth.uid()) OR user_id = auth.uid());

-- UNIVERSE INVITATIONS POLICIES (Restricted to Admins)
CREATE POLICY "Invitations select admin" ON public.universe_invitations
    FOR SELECT TO authenticated
    USING (public.is_universe_admin(universe_id, auth.uid()));

CREATE POLICY "Invitations insert admin" ON public.universe_invitations
    FOR INSERT TO authenticated
    WITH CHECK (public.is_universe_admin(universe_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Invitations delete admin" ON public.universe_invitations
    FOR DELETE TO authenticated
    USING (public.is_universe_admin(universe_id, auth.uid()));

-- STARS & MEMORIES POLICIES
CREATE POLICY "Stars select" ON public.stars
    FOR SELECT TO authenticated
    USING (public.can_read_universe(universe_id, auth.uid()));

CREATE POLICY "Stars modify admin" ON public.stars
    FOR ALL TO authenticated
    USING (public.is_universe_admin(universe_id, auth.uid()))
    WITH CHECK (public.is_universe_admin(universe_id, auth.uid()));

CREATE POLICY "Memories select" ON public.memories
    FOR SELECT TO authenticated
    USING (public.can_read_universe(universe_id, auth.uid()));

CREATE POLICY "Memories modify admin" ON public.memories
    FOR ALL TO authenticated
    USING (public.is_universe_admin(universe_id, auth.uid()))
    WITH CHECK (public.is_universe_admin(universe_id, auth.uid()));

-- STORIES & STORY MEMORIES POLICIES
CREATE POLICY "Stories select" ON public.stories
    FOR SELECT TO authenticated
    USING (public.can_read_universe(universe_id, auth.uid()));

CREATE POLICY "Stories modify admin" ON public.stories
    FOR ALL TO authenticated
    USING (public.is_universe_admin(universe_id, auth.uid()))
    WITH CHECK (public.is_universe_admin(universe_id, auth.uid()));

CREATE POLICY "Story memories select" ON public.story_memories
    FOR SELECT TO authenticated
    USING (public.can_read_universe(universe_id, auth.uid()));

CREATE POLICY "Story memories modify admin" ON public.story_memories
    FOR ALL TO authenticated
    USING (public.is_universe_admin(universe_id, auth.uid()))
    WITH CHECK (public.is_universe_admin(universe_id, auth.uid()));

-- MEDIA ASSETS POLICIES
CREATE POLICY "Media select" ON public.media_assets
    FOR SELECT TO authenticated
    USING (public.can_read_universe(universe_id, auth.uid()));

CREATE POLICY "Media insert writer" ON public.media_assets
    FOR INSERT TO authenticated
    WITH CHECK (public.can_write_universe(universe_id, auth.uid()) AND uploaded_by = auth.uid());

CREATE POLICY "Media delete uploader_or_admin" ON public.media_assets
    FOR DELETE TO authenticated
    USING (uploaded_by = auth.uid() OR public.is_universe_admin(universe_id, auth.uid()));

-- CONVERSATIONS & MESSAGES POLICIES
CREATE POLICY "Conversations select" ON public.conversations
    FOR SELECT TO authenticated
    USING (public.can_read_universe(universe_id, auth.uid()));

CREATE POLICY "Conversations modify admin" ON public.conversations
    FOR ALL TO authenticated
    USING (public.is_universe_admin(universe_id, auth.uid()))
    WITH CHECK (public.is_universe_admin(universe_id, auth.uid()));

CREATE POLICY "Messages select" ON public.messages
    FOR SELECT TO authenticated
    USING (public.can_read_universe(universe_id, auth.uid()));

CREATE POLICY "Messages insert writer" ON public.messages
    FOR INSERT TO authenticated
    WITH CHECK (public.can_write_universe(universe_id, auth.uid()) AND sender_id = auth.uid());

DROP POLICY IF EXISTS "Messages update sender" ON public.messages;
CREATE POLICY "Messages update sender or reader" ON public.messages
    FOR UPDATE TO authenticated
    USING (sender_id = auth.uid() OR public.can_read_universe(universe_id, auth.uid()))
    WITH CHECK (public.can_read_universe(universe_id, auth.uid()));

CREATE POLICY "Messages delete sender_or_admin" ON public.messages
    FOR DELETE TO authenticated
    USING (sender_id = auth.uid() OR public.is_universe_admin(universe_id, auth.uid()));

-- WEBRTC CALL SESSIONS & PARTICIPANTS POLICIES
CREATE POLICY "Call sessions select" ON public.call_sessions
    FOR SELECT TO authenticated
    USING (public.can_read_universe(universe_id, auth.uid()));

CREATE POLICY "Call sessions insert writer" ON public.call_sessions
    FOR INSERT TO authenticated
    WITH CHECK (public.can_write_universe(universe_id, auth.uid()) AND host_id = auth.uid());

CREATE POLICY "Call sessions update host_or_admin" ON public.call_sessions
    FOR UPDATE TO authenticated
    USING (host_id = auth.uid() OR public.is_universe_admin(universe_id, auth.uid()))
    WITH CHECK (host_id = auth.uid() OR public.is_universe_admin(universe_id, auth.uid()));

CREATE POLICY "Call participants select" ON public.call_participants
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.call_sessions cs
        WHERE cs.id = call_session_id AND cs.universe_id = universe_id AND public.can_read_universe(cs.universe_id, auth.uid())
    ));

-- Require Active Call Status ('initiated', 'ringing', 'connected') to Join
CREATE POLICY "Call participants insert active_session_writer" ON public.call_participants
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid() AND EXISTS (
            SELECT 1 FROM public.call_sessions cs
            WHERE cs.id = call_session_id
              AND cs.universe_id = universe_id
              AND cs.status IN ('initiated', 'ringing', 'connected')
              AND public.can_write_universe(cs.universe_id, auth.uid())
        )
    );

CREATE POLICY "Call participants delete self_or_host" ON public.call_participants
    FOR DELETE TO authenticated
    USING (
        user_id = auth.uid() OR EXISTS (
            SELECT 1 FROM public.call_sessions cs
            WHERE cs.id = call_session_id AND cs.universe_id = universe_id AND cs.host_id = auth.uid()
        )
    );

-- PER-USER UNIVERSE PROGRESS POLICIES
CREATE POLICY "Progress select own" ON public.user_universe_progress
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() AND public.can_read_universe(universe_id, auth.uid()));

CREATE POLICY "Progress modify own" ON public.user_universe_progress
    FOR ALL TO authenticated
    USING (user_id = auth.uid() AND public.can_read_universe(universe_id, auth.uid()))
    WITH CHECK (user_id = auth.uid() AND public.can_read_universe(universe_id, auth.uid()));

-- ------------------------------------------------------------
-- 6. STORAGE BUCKET CONFIGURATION & DUAL-BOUND STORAGE SECURITY POLICIES
-- ------------------------------------------------------------

-- Create Private Storage Bucket for Universe Media
INSERT INTO storage.buckets (id, name, public)
VALUES ('universe_media', 'universe_media', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage RLS Policies (path format: universe_id/memory_id/file.ext or universe_id/file.ext)
DROP POLICY IF EXISTS "Universe media select" ON storage.objects;
DROP POLICY IF EXISTS "Universe media insert" ON storage.objects;
DROP POLICY IF EXISTS "Universe media delete" ON storage.objects;

CREATE POLICY "Universe media select" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'universe_media' AND
        public.can_read_storage_asset(
            ((storage.foldername(name))[1])::uuid,
            CASE
                WHEN array_length(storage.foldername(name), 1) >= 2 
                     AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                THEN ((storage.foldername(name))[2])::uuid
                ELSE NULL
            END,
            auth.uid()
        )
    );

CREATE POLICY "Universe media insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'universe_media' AND
        public.can_write_storage_asset(
            ((storage.foldername(name))[1])::uuid,
            CASE
                WHEN array_length(storage.foldername(name), 1) >= 2 
                     AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                THEN ((storage.foldername(name))[2])::uuid
                ELSE NULL
            END,
            auth.uid()
        )
    );

CREATE POLICY "Universe media delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'universe_media' AND
        public.can_write_storage_asset(
            ((storage.foldername(name))[1])::uuid,
            CASE
                WHEN array_length(storage.foldername(name), 1) >= 2 
                     AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                THEN ((storage.foldername(name))[2])::uuid
                ELSE NULL
            END,
            auth.uid()
        )
    );

-- ------------------------------------------------------------
-- 7. SUPABASE REALTIME PUBLICATION & REALTIME RLS AUTHORIZATION
-- ------------------------------------------------------------

-- Add CDC Tables to supabase_realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'call_sessions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.call_sessions;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_universe_progress'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user_universe_progress;
    END IF;
END $$;

-- Realtime Authorization Policies on realtime.messages table (for Broadcast & Presence Channels)
-- Naming Convention for Channels: 'universe:{universe_id}:call:{call_session_id}' or 'universe:{universe_id}:chat'
-- Note: RLS on realtime.messages is pre-enabled by Supabase. Do NOT run ALTER TABLE on realtime schema objects.

DROP POLICY IF EXISTS "Realtime universe channel read" ON realtime.messages;
DROP POLICY IF EXISTS "Realtime universe channel write" ON realtime.messages;

CREATE POLICY "Realtime universe channel read" ON realtime.messages
    FOR SELECT TO authenticated
    USING (
        split_part(realtime.topic(), ':', 1) = 'universe' AND
        public.can_read_universe((split_part(realtime.topic(), ':', 2))::uuid, auth.uid())
    );

CREATE POLICY "Realtime universe channel write" ON realtime.messages
    FOR INSERT TO authenticated
    WITH CHECK (
        split_part(realtime.topic(), ':', 1) = 'universe' AND
        public.can_write_universe((split_part(realtime.topic(), ':', 2))::uuid, auth.uid())
    );

