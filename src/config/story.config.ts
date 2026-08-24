/**
 * story.config.ts — Narrative storyline configuration for Our Universe.
 * Controls typewriter text sequences, letters, final questions, and path outcomes.
 */

export interface StoryLine {
  text: string;
  pause: number;
}

export interface LetterLine {
  id: string;
  text: string;
  type?: 'heading' | 'paragraph' | 'signature';
}

export interface StoryConfig {
  opening: {
    lines: StoryLine[];
  };
  letter: {
    title: string;
    date: string;
    paragraphs?: string[];
    lines: LetterLine[];
  };
  final: {
    title: string;
    question: string;
    yesLabel: string;
    noLabel: string;
  };
  finalQuestion: {
    prelude: string;
    question: string;
    yesLabel: string;
    noLabel: string;
  };
  yesPath: {
    title: string;
    paragraphs: string[];
    connectionText: string;
    followUp: string;
  };
  noPath: {
    title: string;
    paragraphs: string[];
    initial: string;
    followUp: string;
    forgiveLabel: string;
    noForgiveLabel: string;
  };
  forgivePath: {
    response: string;
    followUp: string;
  };
  noForgivePath: {
    lines: string[];
  };
}

export const storyConfig: StoryConfig = {
  opening: {
    lines: [
      { text: 'In a infinite sea of noise, stars align to form a single connection...', pause: 2000 },
      { text: 'Every star holds a memory, waiting to be rediscovered.', pause: 2500 },
      { text: 'Welcome to Our Universe.', pause: 3000 },
    ],
  },
  letter: {
    title: 'A Letter Written Across Time',
    date: 'Cosmic Sequence',
    paragraphs: [
      'To whoever finds this star in the darkness,',
      'Some connections are written into the geometry of space long before we recognize them.',
      'Every light in this constellation is a reminder of moments that shaped our journey.',
      'Thank you for taking the time to explore this space.',
      'With love across the cosmos,',
    ],
    lines: [
      { id: 'l1', text: 'To whoever finds this star in the darkness,', type: 'heading' },
      { id: 'l2', text: 'Some connections are written into the geometry of space long before we recognize them.', type: 'paragraph' },
      { id: 'l3', text: 'Every light in this constellation is a reminder of moments that shaped our journey.', type: 'paragraph' },
      { id: 'l4', text: 'Thank you for taking the time to explore this space.', type: 'paragraph' },
      { id: 'l5', text: 'With love across the cosmos,', type: 'signature' },
    ],
  },
  final: {
    title: 'A Final Celestial Question',
    question: 'Shall we keep exploring this Universe together?',
    yesLabel: 'Yes, Always',
    noLabel: 'Not Yet',
  },
  finalQuestion: {
    prelude: 'The 12th star is unlocked. The constellation is complete.',
    question: 'Shall we keep exploring this Universe together?',
    yesLabel: 'Yes, Always',
    noLabel: 'Not Yet',
  },
  yesPath: {
    title: 'The Constellation Continues',
    paragraphs: [
      'The stars shine brighter as your decision echoes through space.',
      'Our Universe remains open, growing with every new shared memory.',
    ],
    connectionText: 'Connection Established.',
    followUp: 'Maybe we should start with a conversation.',
  },
  noPath: {
    title: 'A Peaceful Resonance',
    paragraphs: [
      'Every star respects your choice and continues to glow softly in the distance.',
      'You are always welcome back whenever you wish to return.',
    ],
    initial: 'Okay.',
    followUp: 'I understand.',
    forgiveLabel: 'I forgive you',
    noForgiveLabel: 'I need more time',
  },
  forgivePath: {
    response: 'Thank you for your warmth and grace.',
    followUp: 'The stars will continue to shine for you.',
  },
  noForgivePath: {
    lines: [
      'I respect your boundaries and your feelings.',
      'Take all the time you need.',
      'This universe will remain here, waiting in peace.',
    ],
  },
};
