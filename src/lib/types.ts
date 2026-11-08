export type Page = 'home' | 'discover' | 'library' | 'profile' | 'settings';
export type Category =
  | 'All games'
  | 'Adventure'
  | 'Roleplay'
  | 'Action'
  | 'Simulation'
  | 'Obby'
  | 'Horror';
export interface Game {
  id: string;
  name: string;
  creator: string;
  category: Exclude<Category, 'All games'>;
  image: string;
  description: string;
  fixturePlayers: number;
  fixtureRating: number;
}
export interface Preferences {
  compactCards: boolean;
  reduceMotion: boolean;
  startPage: Page;
  preferredAdapter: 'auto' | 'windows' | 'sober';
}
export interface RecentGame {
  gameId: string;
  launchedAt: string;
}
export interface LibraryData {
  favorites: string[];
  recent: RecentGame[];
  preferences: Preferences;
}
export interface AdapterStatus {
  id: 'windows' | 'sober';
  name: string;
  platform: string;
  installation: 'detected' | 'notFound' | 'unsupported' | 'unknown';
  location: string | null;
  detail: string;
  capabilities: { detect: boolean; launch: boolean };
}
