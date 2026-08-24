import type {
  Star,
  UniverseMemory,
  UniverseThemeConfig,
  Memory,
  CelestialType,
  AnimationStyle,
  UnlockCondition,
} from '../types';
import { memories as defaultMemories } from '../config/memories.config';

/** Default visual metadata presets matching static memories.config.ts 1..12 stars */
const STAR_PRESETS: Record<
  number,
  {
    celestialType: CelestialType;
    color: string;
    scale: number;
    animationStyle: AnimationStyle;
  }
> = {
  1: { celestialType: 'star', color: '#4fc3f7', scale: 1.2, animationStyle: 'pulse' },
  2: { celestialType: 'planet', color: '#ab47bc', scale: 1.1, animationStyle: 'orbit' },
  3: { celestialType: 'constellation', color: '#ffb74d', scale: 1.3, animationStyle: 'breathe' },
  4: { celestialType: 'nebula', color: '#e91e63', scale: 1.4, animationStyle: 'float' },
  5: { celestialType: 'star', color: '#81c784', scale: 1.1, animationStyle: 'spin' },
  6: { celestialType: 'capsule', color: '#26c6da', scale: 1.2, animationStyle: 'pulse' },
  7: { celestialType: 'mystery', color: '#7e57c2', scale: 1.3, animationStyle: 'breathe' },
  8: { celestialType: 'portal', color: '#ff7043', scale: 1.4, animationStyle: 'spin' },
  9: { celestialType: 'star', color: '#64b5f6', scale: 1.2, animationStyle: 'pulse' },
  10: { celestialType: 'constellation', color: '#f06292', scale: 1.3, animationStyle: 'breathe' },
  11: { celestialType: 'star', color: '#ffd54f', scale: 1.2, animationStyle: 'orbit' },
  12: { celestialType: 'star', color: '#4dd0e1', scale: 1.5, animationStyle: 'pulse' },
};

/** Deterministically derives celestial mesh type based on star_number */
export function getCelestialType(starNumber: number): CelestialType {
  const preset = STAR_PRESETS[starNumber];
  return preset ? preset.celestialType : 'star';
}

/** Deterministically derives 3D star color based on star_number and universe theme config */
export function getStarColor(starNumber: number, themeConfig?: UniverseThemeConfig): string {
  if (themeConfig?.starGlowColor && typeof themeConfig.starGlowColor === 'string') {
    return themeConfig.starGlowColor;
  }
  const preset = STAR_PRESETS[starNumber];
  return preset ? preset.color : '#4fc3f7';
}

/** Deterministically derives procedural animation style based on star_number */
export function getAnimationStyle(starNumber: number): AnimationStyle {
  const preset = STAR_PRESETS[starNumber];
  return preset ? preset.animationStyle : 'pulse';
}

/** Deterministically derives 3D mesh scale factor based on star_number */
export function getStarScale(starNumber: number): number {
  const preset = STAR_PRESETS[starNumber];
  return preset ? preset.scale : 1.2;
}

/** Derives star unlock condition (all DB stars unlocked by default for seamless exploration) */
export function getStarUnlockCondition(_starNumber: number): UnlockCondition {
  return { type: 'always', value: 0 };
}

/**
  * Converts a single database Star and optional UniverseMemory into a 3D Memory render object.
  */
export function mapStarToMemory(
  star: Star,
  memory?: UniverseMemory | null,
  themeConfig?: UniverseThemeConfig
): Memory {
  const formattedId = `memory-${String(star.star_number).padStart(2, '0')}`;

  return {
    id: formattedId,
    starId: star.id,
    type: 'text',
    celestialType: getCelestialType(star.star_number),
    title: memory?.title || star.name || `Star ${star.star_number}`,
    date: memory?.memory_date || star.subtitle || 'Cosmic Moment',
    description: memory?.content || star.description || star.subtitle || 'A glowing star suspended in the cosmos.',
    color: getStarColor(star.star_number, themeConfig),
    position: {
      x: star.position_x,
      y: star.position_y,
      z: star.position_z,
    },
    scale: getStarScale(star.star_number),
    animationStyle: getAnimationStyle(star.star_number),
    unlockCondition: getStarUnlockCondition(star.star_number),
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(val: string): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

/**
  * Converts a rendered Memory ID ("memory-01") to its database Star.id UUID.
  */
export function getStarUuidFromMemoryId(memoryId: string, stars?: Star[]): string | null {
  if (!memoryId) return null;

  // 1. Parse star number if memoryId is formatted as "memory-01"
  if (stars && stars.length > 0) {
    const match = memoryId.match(/^memory-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      const foundStar = stars.find((s) => s.star_number === num);
      if (foundStar && isUuid(foundStar.id)) return foundStar.id;
    }

    // 2. Direct match by UUID
    const directStar = stars.find((s) => s.id === memoryId);
    if (directStar && isUuid(directStar.id)) return directStar.id;
  }

  // 3. Check if memoryId itself is a valid UUID
  if (isUuid(memoryId)) return memoryId;

  return null;
}

/**
  * Converts a database Star UUID or star_number to a rendered Memory ID ("memory-01").
  */
export function getMemoryIdFromStarUuid(starUuidOrId: string, stars?: Star[]): string {
  if (!starUuidOrId) return starUuidOrId;

  // 1. If already formatted as "memory-01", return directly
  if (/^memory-\d+$/i.test(starUuidOrId)) {
    return starUuidOrId;
  }

  // 2. Match by Star UUID
  if (stars && stars.length > 0) {
    const foundStar = stars.find((s) => s.id === starUuidOrId);
    if (foundStar) {
      return `memory-${String(foundStar.star_number).padStart(2, '0')}`;
    }
  }

  return starUuidOrId;
}

/**
  * Maps an array of database Stars and UniverseMemories into a renderable Memory[] array.
  * Falls back cleanly to static memories.config.ts if stars array is empty.
  */
export function mapDbContentToMemories(
  stars: Star[],
  memoriesList: UniverseMemory[],
  themeConfig?: UniverseThemeConfig
): Memory[] {
  if (!stars || stars.length === 0) {
    return defaultMemories;
  }

  const sortedStars = [...stars].sort((a, b) => a.star_number - b.star_number);
  const memoryByStarId = new Map<string, UniverseMemory>();
  const memoryByDisplayOrder = new Map<number, UniverseMemory>();

  for (const m of memoriesList) {
    if (m.star_id) {
      memoryByStarId.set(m.star_id, m);
    }
    if (typeof m.display_order === 'number') {
      memoryByDisplayOrder.set(m.display_order, m);
    }
  }

  return sortedStars.map((star, index) => {
    const matchedMemory =
      memoryByStarId.get(star.id) ||
      memoryByDisplayOrder.get(star.star_number - 1) ||
      memoriesList[index] ||
      null;

    return mapStarToMemory(star, matchedMemory, themeConfig);
  });
}
