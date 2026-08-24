-- ============================================================
-- OUR UNIVERSE v2 — AUTOMATIC DEFAULT CONTENT SEEDING TRIGGER
-- ============================================================
-- Run this script in the Supabase SQL Editor to enable automatic
-- seeding of default 3D stars, memories, and stories for every
-- newly created Universe.
-- ============================================================

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
