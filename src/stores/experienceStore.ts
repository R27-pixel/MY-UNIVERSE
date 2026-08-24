import { create } from 'zustand';
import type {
  ExperiencePhase,
  Profile,
  Universe,
  UniverseMember,
  UserUniverseProgress,
  Star,
  UniverseMemory,
  UniverseStory,
  StoryMemory,
  UniverseContentPayload,
} from '../types';
import {
  fetchUserProgress,
  recordStarDiscovery,
  recordChatUnlocked,
  recordStar13Unlocked,
  recordHiddenGameCompleted,
  fetchProfile,
  listUserUniverses,
  fetchUniverse,
  createUniverse as apiCreateUniverse,
  fetchUniverseMember,
  fetchUserUniverseProgress,
  recordV2StarDiscovery,
  recordV2Star13Unlocked,
  recordV2HiddenGameCompleted,
  fetchUniverseContent,
  updateUniverseMemory,
  updateUniverseStar,
  updateUniverseStory,
} from '../services/supabase/SupabaseService';
import { getStarUuidFromMemoryId, getMemoryIdFromStarUuid } from '../utils/celestialMapper';

interface ExperienceState {
  // Legacy Experience State (Preserved for V1 3D scene compatibility)
  phase: ExperiencePhase;
  previousPhase: ExperiencePhase | null;
  activeMemoryId: string | null;
  discoveredMemoryIds: Set<string>;
  totalMemories: number;
  isTransitioning: boolean;
  hasCompletedOpening: boolean;
  hasVisitedArchive: boolean;
  hasReadLetter: boolean;
  chosenPath: 'yes' | 'no' | null;
  forgivenessChoice: 'forgive' | 'no-forgive' | null;

  // 13th Star & Hidden Game State
  star13Unlocked: boolean;
  star13Discovered: boolean;
  isExploding13thStar: boolean;
  showPortalModal: boolean;
  hiddenGameCompleted: boolean;

  // Legacy Auth Properties (Preserved)
  isAuthInitializing: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  userProfile: 'x' | 'y' | 'r27' | 'spam' | null;
  experienceCompleted: boolean;

  // V2 Authentication & Profile State
  currentUser: any | null;
  currentProfile: Profile | null;

  // V2 Universes & Memberships State
  userUniverses: Universe[];
  activeUniverse: Universe | null;
  activeMembership: UniverseMember | null;
  isLoadingUniverses: boolean;
  showUniverseModal: boolean;

  // Actions
  setShowUniverseModal: (v: boolean) => void;

  // V2 Progress State
  activeUniverseProgress: UserUniverseProgress | null;
  isLoadingProgress: boolean;

  // V2 Content State (Phase 6A)
  activeUniverseStars: Star[];
  activeUniverseMemories: UniverseMemory[];
  activeUniverseStories: UniverseStory[];
  activeUniverseStoryMemories: StoryMemory[];
  isLoadingContent: boolean;

  // Actions
  setUserProfile: (profile: 'x' | 'y' | 'r27' | 'spam' | null) => void;
  setPhase: (phase: ExperiencePhase) => void;
  hydrateUserSession: (session: any) => Promise<void>;
  signOut: () => Promise<void>;
  markChatUnlocked: () => Promise<void>;
  discoverMemory: (id: string) => Promise<void>;
  setActiveMemory: (id: string | null) => void;
  setTransitioning: (v: boolean) => void;
  completeOpening: () => void;
  visitArchive: () => void;
  readLetter: () => void;
  choosePath: (path: 'yes' | 'no') => void;
  chooseForgiveness: (choice: 'forgive' | 'no-forgive') => void;

  // V2 Actions
  loadUserProfile: (userId?: string) => Promise<Profile | null>;
  loadUserUniverses: (userId?: string) => Promise<Universe[]>;
  selectUniverse: (universeId: string) => Promise<void>;
  createUniverse: (title: string, slug?: string, isPrivate?: boolean, themeConfig?: any) => Promise<Universe>;
  loadActiveUniverseProgress: () => Promise<UserUniverseProgress | null>;
  loadActiveUniverseContent: () => Promise<UniverseContentPayload>;
  updateMemoryContent: (
    memoryId: string,
    memoryUpdates: Partial<UniverseMemory>,
    starUpdates?: Partial<Star>
  ) => Promise<void>;
  updateStoryContent: (
    storyId: string,
    updates: Partial<UniverseStory>
  ) => Promise<void>;

  // 13th Star & Portal Actions
  unlockStar13: () => Promise<void>;
  setStar13Discovered: (v: boolean) => void;
  triggerStar13Explosion: () => void;
  finishStar13Explosion: () => void;
  openPortalModal: () => void;
  closePortalModal: () => void;
  completeHiddenGame: () => Promise<void>;

  getDiscoveredCount: () => number;
  isMemoryDiscovered: (id: string) => boolean;
  isMemoryUnlocked: (id: string) => boolean;
}

let activeHydrationUid: string | null = null;
let activeHydrationPromise: Promise<void> | null = null;

export const useExperienceStore = create<ExperienceState>((set, get) => ({
  phase: 'LOADING',
  previousPhase: null,
  activeMemoryId: null,
  discoveredMemoryIds: new Set<string>(),
  totalMemories: 12,
  isTransitioning: false,
  hasCompletedOpening: false,
  hasVisitedArchive: false,
  hasReadLetter: false,
  chosenPath: null,
  forgivenessChoice: null,

  star13Unlocked: false,
  star13Discovered: false,
  isExploding13thStar: false,
  showPortalModal: false,
  hiddenGameCompleted: false,

  isAuthInitializing: true,
  isAuthenticated: false,
  userId: null,
  userProfile: null,
  experienceCompleted: false,

  // V2 State Initial Values
  currentUser: null,
  currentProfile: null,

  userUniverses: [],
  activeUniverse: null,
  activeMembership: null,
  isLoadingUniverses: false,
  showUniverseModal: false,

  setShowUniverseModal: (v) => set({ showUniverseModal: v }),

  activeUniverseProgress: null,
  isLoadingProgress: false,

  activeUniverseStars: [],
  activeUniverseMemories: [],
  activeUniverseStories: [],
  activeUniverseStoryMemories: [],
  isLoadingContent: false,

  setUserProfile: (profile) =>
    set((state) => ({
      userProfile: profile,
      isAuthenticated: Boolean(profile),
      isAuthInitializing: false,
      phase: profile && (state.phase === 'LOADING' || !state.isAuthenticated) ? 'OPENING' : state.phase,
    })),

  setPhase: (phase) => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('universe_active_phase', phase);
      } catch (e) {}
    }
    set((state) => ({
      previousPhase: state.phase,
      phase,
    }));
  },

  /* V2 Profile Loading */
  loadUserProfile: async (targetUserId?: string) => {
    const uid = targetUserId || get().userId;
    if (!uid) return null;
    try {
      const profile = await fetchProfile(uid);
      set({ currentProfile: profile });
      return profile;
    } catch (err) {
      console.error('[Store] Error loading user profile:', err);
      return null;
    }
  },

  /* V2 Universes Loading */
  loadUserUniverses: async (targetUserId?: string) => {
    const uid = targetUserId || get().userId;
    if (!uid) {
      set({ userUniverses: [], isLoadingUniverses: false });
      return [];
    }
    set({ isLoadingUniverses: true });
    try {
      const universes = await listUserUniverses(uid);
      set({ userUniverses: universes, isLoadingUniverses: false });

      // Auto-selection behavior:
      // If exactly 1 universe exists and no active universe is chosen yet, select it.
      if (universes.length === 1 && !get().activeUniverse) {
        await get().selectUniverse(universes[0].id);
      }
      return universes;
    } catch (err) {
      console.error('[Store] Error loading user universes:', err);
      set({ userUniverses: [], isLoadingUniverses: false });
      return [];
    }
  },

  /* V2 Select Active Universe */
  selectUniverse: async (universeId: string) => {
    const uid = get().userId;
    if (!universeId) return;

    let universe = get().userUniverses.find((u) => u.id === universeId) || null;
    if (!universe) {
      universe = await fetchUniverse(universeId);
    }
    if (!universe) {
      console.error('[Store] Universe not found:', universeId);
      return;
    }

    set({ activeUniverse: universe, showUniverseModal: false });

    // 1. Load active universe DB content FIRST (Phase 6A) so activeUniverseStars is populated
    await get().loadActiveUniverseContent();

    if (uid) {
      // 2. Load user membership role for this universe
      const membership = await fetchUniverseMember(universe.id, uid);
      set({ activeMembership: membership });

      // 3. Load user progress SECOND so star UUIDs map to rendered "memory-01", "memory-02" IDs
      await get().loadActiveUniverseProgress();
    }
  },

  /* V2 Create Universe */
  createUniverse: async (title: string, slug?: string, isPrivate: boolean = true, themeConfig?: any) => {
    const newUniverse = await apiCreateUniverse(title, slug, isPrivate, themeConfig);
    const uid = get().userId;
    if (uid) {
      await get().loadUserUniverses(uid);
      await get().selectUniverse(newUniverse.id);
    }
    set({ showUniverseModal: false });
    return newUniverse;
  },

  /* V2 Load Progress for Active Universe */
  loadActiveUniverseProgress: async () => {
    const uid = get().userId;
    const activeUni = get().activeUniverse;
    if (!uid) {
      set({ activeUniverseProgress: null, isLoadingProgress: false });
      return null;
    }

    set({ isLoadingProgress: true });
    try {
      let progress = activeUni ? await fetchUserUniverseProgress(activeUni.id, uid) : null;
      let rawStarIds = progress?.discovered_star_ids || [];

      // Fallback to legacy progress table if active universe progress has no stars yet
      if (rawStarIds.length === 0) {
        const legacyProgress = await fetchUserProgress(uid);
        if (legacyProgress && legacyProgress.discoveredStars.length > 0) {
          rawStarIds = legacyProgress.discoveredStars;
        }
      }

      const stars = get().activeUniverseStars;
      const renderedIds = new Set<string>();

      for (const existingId of get().discoveredMemoryIds) {
        if (/^memory-\d+$/i.test(existingId)) {
          renderedIds.add(existingId);
        }
      }

      for (const rawId of rawStarIds) {
        const renderedId = getMemoryIdFromStarUuid(rawId, stars);
        if (renderedId && /^memory-\d+$/i.test(renderedId)) {
          renderedIds.add(renderedId);
        }
      }

      set({
        activeUniverseProgress: progress,
        discoveredMemoryIds: renderedIds,
        experienceCompleted: Boolean(progress?.is_experience_completed) || renderedIds.size >= 12,
        star13Unlocked: Boolean(progress?.is_star_13_unlocked) || renderedIds.size >= 12,
        star13Discovered: Boolean(progress?.is_star_13_unlocked) || renderedIds.size >= 12,
        hiddenGameCompleted: Boolean(progress?.is_hidden_game_completed),
        isLoadingProgress: false,
      });
      return progress;
    } catch (err) {
      console.error('[Store] Error loading active universe progress:', err);
      set({ isLoadingProgress: false });
      return null;
    }
  },

  /* V2 Load DB Content for Active Universe (Phase 6A) */
  loadActiveUniverseContent: async () => {
    const activeUni = get().activeUniverse;
    if (!activeUni) {
      set({
        activeUniverseStars: [],
        activeUniverseMemories: [],
        activeUniverseStories: [],
        activeUniverseStoryMemories: [],
        isLoadingContent: false,
      });
      return { stars: [], memories: [], stories: [], storyMemories: [] };
    }

    set({ isLoadingContent: true });
    try {
      const content = await fetchUniverseContent(activeUni.id);
      set({
        activeUniverseStars: content.stars,
        activeUniverseMemories: content.memories,
        activeUniverseStories: content.stories,
        activeUniverseStoryMemories: content.storyMemories,
        isLoadingContent: false,
      });

      // Re-sync user progress now that stars are loaded
      if (get().userId) {
        await get().loadActiveUniverseProgress();
      }

      return content;
    } catch (err) {
      console.error('[Store] Error loading active universe content:', err);
      set({
        activeUniverseStars: [],
        activeUniverseMemories: [],
        activeUniverseStories: [],
        activeUniverseStoryMemories: [],
        isLoadingContent: false,
      });
      return { stars: [], memories: [], stories: [], storyMemories: [] };
    }
  },

  /* V2 Creator Memory & Star Content Update */
  updateMemoryContent: async (memoryId, memoryUpdates, starUpdates) => {
    const activeUni = get().activeUniverse;
    if (!activeUni || !memoryId) return;

    await updateUniverseMemory(activeUni.id, memoryId, memoryUpdates);
    if (starUpdates) {
      const targetMemory = get().activeUniverseMemories.find((m) => m.id === memoryId);
      if (targetMemory?.star_id) {
        await updateUniverseStar(activeUni.id, targetMemory.star_id, starUpdates);
      }
    }
    // Re-sync universe DB content to update 3D scene & UI state live
    await get().loadActiveUniverseContent();
  },

  /* V2 Creator Story Sequence Update */
  updateStoryContent: async (storyId, updates) => {
    const activeUni = get().activeUniverse;
    if (!activeUni || !storyId) return;

    await updateUniverseStory(activeUni.id, storyId, updates);
    // Re-sync universe DB content to update story sequences live
    await get().loadActiveUniverseContent();
  },

  /* Session Hydration for V1 & V2 */
  hydrateUserSession: async (session: any) => {
    const user = session?.user;
    if (!user?.id) {
      activeHydrationUid = null;
      activeHydrationPromise = null;
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem('universe_active_phase');
        } catch (e) {}
      }
      set({
        isAuthInitializing: false,
        isAuthenticated: false,
        userId: null,
        userProfile: null,
        currentUser: null,
        currentProfile: null,
        userUniverses: [],
        activeUniverse: null,
        activeMembership: null,
        activeUniverseProgress: null,
        activeUniverseStars: [],
        activeUniverseMemories: [],
        activeUniverseStories: [],
        activeUniverseStoryMemories: [],
        experienceCompleted: false,
        star13Unlocked: false,
        star13Discovered: false,
        hiddenGameCompleted: false,
        discoveredMemoryIds: new Set(),
      });
      return;
    }

    const uid = user.id;

    if (activeHydrationUid === uid && activeHydrationPromise) {
      await activeHydrationPromise;
      return;
    }

    activeHydrationUid = uid;
    activeHydrationPromise = (async () => {
      try {
        // Load V2 Profile
        let v2Profile: Profile | null = null;
        try {
          v2Profile = await fetchProfile(uid);
        } catch (e) {}

        // Load V2 user universe progress
        let progress: any = { discoveredStars: [], experienceCompleted: false, star13Unlocked: false, hiddenGameCompleted: false };
        try {
          progress = await fetchUserProgress(uid);
        } catch (err) {
          console.warn('[Session Hydration Notice] User progress fetch error:', err);
        }

        const rawProgressStars = progress?.discoveredStars || [];
        const starSet = new Set<string>();
        for (const sId of rawProgressStars) {
          const mapped = getMemoryIdFromStarUuid(sId, get().activeUniverseStars);
          if (mapped && /^memory-\d+$/i.test(mapped)) {
            starSet.add(mapped);
          } else if (/^memory-\d+$/i.test(sId)) {
            starSet.add(sId);
          }
        }
        const isCompleted = Boolean(progress?.experienceCompleted) || starSet.size >= 12;
        const star13Unlocked = Boolean(progress?.star13Unlocked || starSet.size >= 12);
        const hiddenGameCompleted = Boolean(progress?.hiddenGameCompleted);

        const savedPhase = typeof window !== 'undefined' ? sessionStorage.getItem('universe_active_phase') : null;
        const validSavedPhase = savedPhase && savedPhase !== 'LOADING' ? (savedPhase as ExperiencePhase) : null;

        const targetPhase: ExperiencePhase =
          get().phase === 'WELCOME_BACK' || validSavedPhase === 'WELCOME_BACK'
            ? 'WELCOME_BACK'
            : validSavedPhase
            ? validSavedPhase
            : isCompleted
            ? 'WELCOME_BACK'
            : get().phase === 'LOADING'
            ? 'OPENING'
            : get().phase;

        set(() => ({
          isAuthInitializing: false,
          isAuthenticated: true,
          userId: uid,
          userProfile: null,
          currentUser: user,
          currentProfile: v2Profile,
          discoveredMemoryIds: starSet,
          experienceCompleted: isCompleted,
          star13Unlocked,
          star13Discovered: star13Unlocked,
          hiddenGameCompleted,
          phase: targetPhase,
        }));

        // Load Universes after setting authenticated user ID
        await get().loadUserUniverses(uid);
      } finally {
        activeHydrationPromise = null;
      }
    })();

    await activeHydrationPromise;
  },

  /* Sign Out Action */
  signOut: async () => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('universe_active_phase');
      } catch (e) {}
    }
    try {
      const { callService } = await import('../services/callService');
      callService.disconnectSupabaseSignaling();
    } catch (e) {}
    const { supabase: supabaseClient } = await import('../services/supabase/SupabaseService');
    if (supabaseClient) {
      await supabaseClient.auth.signOut().catch(() => {});
    }

    set({
      isAuthInitializing: false,
      isAuthenticated: false,
      userId: null,
      userProfile: null,
      currentUser: null,
      currentProfile: null,
      userUniverses: [],
      activeUniverse: null,
      activeMembership: null,
      activeUniverseProgress: null,
      activeUniverseStars: [],
      activeUniverseMemories: [],
      activeUniverseStories: [],
      activeUniverseStoryMemories: [],
      experienceCompleted: false,
      star13Unlocked: false,
      star13Discovered: false,
      hiddenGameCompleted: false,
      discoveredMemoryIds: new Set(),
      phase: 'LOADING',
    });
  },

  markChatUnlocked: async () => {
    const state = get();
    set({ experienceCompleted: true });
    if (state.userId) {
      await recordChatUnlocked(state.userId);
    }
  },

  discoverMemory: async (id: string) => {
    const state = get();
    const newSet = new Set(state.discoveredMemoryIds);
    newSet.add(id);

    const isCompleted = state.experienceCompleted || newSet.size >= state.totalMemories;

    // 1. Optimistic UI state update (never resets)
    set({
      discoveredMemoryIds: newSet,
      experienceCompleted: isCompleted,
    });

    // 2. Authoritative V2 persistence if activeUniverse exists
    if (state.activeUniverse) {
      try {
        const starUuid = getStarUuidFromMemoryId(id, state.activeUniverseStars);
        if (starUuid) {
          const updatedProgress = await recordV2StarDiscovery(state.activeUniverse.id, starUuid);
          if (updatedProgress) {
            const rawStarIds = updatedProgress.discovered_star_ids || [];
            const mergedSet = new Set<string>();
            for (const existingId of newSet) {
              if (/^memory-\d+$/i.test(existingId)) {
                mergedSet.add(existingId);
              }
            }
            for (const rId of rawStarIds) {
              const mapped = getMemoryIdFromStarUuid(rId, state.activeUniverseStars);
              if (mapped && /^memory-\d+$/i.test(mapped)) {
                mergedSet.add(mapped);
              }
            }
            set({
              activeUniverseProgress: updatedProgress,
              discoveredMemoryIds: mergedSet,
              experienceCompleted: Boolean(updatedProgress.is_experience_completed) || mergedSet.size >= 12,
              star13Unlocked: Boolean(updatedProgress.is_star_13_unlocked) || mergedSet.size >= 12,
              star13Discovered: Boolean(updatedProgress.is_star_13_unlocked) || mergedSet.size >= 12,
              hiddenGameCompleted: Boolean(updatedProgress.is_hidden_game_completed),
            });
          }
        }
      } catch (e) {
        console.error('[Store] Error recording V2 star discovery:', e);
      }
    }

    // 3. Dual-write fallback to user_universe_progress (legacy table) so state persists cleanly
    if (state.userId) {
      try {
        const updated = await recordStarDiscovery(state.userId, id, state.totalMemories);
        if (updated?.discoveredStars?.length) {
          const mergedSet = new Set<string>();
          for (const existingId of get().discoveredMemoryIds) {
            if (/^memory-\d+$/i.test(existingId)) {
              mergedSet.add(existingId);
            }
          }
          for (const sId of updated.discoveredStars) {
            const mapped = getMemoryIdFromStarUuid(sId, state.activeUniverseStars);
            if (mapped && /^memory-\d+$/i.test(mapped)) {
              mergedSet.add(mapped);
            } else if (/^memory-\d+$/i.test(sId)) {
              mergedSet.add(sId);
            }
          }
          set({
            discoveredMemoryIds: mergedSet,
            experienceCompleted: updated.experienceCompleted || mergedSet.size >= 12,
          });
        }
      } catch (e) {}
    }
  },

  unlockStar13: async () => {
    const state = get();
    set({ star13Unlocked: true, star13Discovered: true });
    if (state.activeUniverse) {
      await recordV2Star13Unlocked(state.activeUniverse.id);
    }
    if (state.userId) {
      await recordStar13Unlocked(state.userId);
    }
  },

  setStar13Discovered: (v) => set({ star13Discovered: v }),

  triggerStar13Explosion: () => set({ isExploding13thStar: true }),

  finishStar13Explosion: () => set({ isExploding13thStar: false, showPortalModal: true, star13Unlocked: true }),

  openPortalModal: () => set({ showPortalModal: true }),

  closePortalModal: () => set({ showPortalModal: false }),

  completeHiddenGame: async () => {
    const state = get();
    set({ hiddenGameCompleted: true, showPortalModal: false });
    if (state.activeUniverse) {
      await recordV2HiddenGameCompleted(state.activeUniverse.id);
    }
    if (state.userId) {
      await recordHiddenGameCompleted(state.userId);
    }
  },

  setActiveMemory: (id) => set({ activeMemoryId: id }),

  setTransitioning: (v) => set({ isTransitioning: v }),

  completeOpening: () => set({ hasCompletedOpening: true }),

  visitArchive: () => set({ hasVisitedArchive: true }),

  readLetter: () => set({ hasReadLetter: true }),

  choosePath: (path) => set({ chosenPath: path }),

  chooseForgiveness: (choice) => set({ forgivenessChoice: choice }),

  getDiscoveredCount: () => get().discoveredMemoryIds.size,

  isMemoryDiscovered: (id) => get().discoveredMemoryIds.has(id),

  isMemoryUnlocked: () => true,
}));
