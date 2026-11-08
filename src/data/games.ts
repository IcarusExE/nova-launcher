import type { Category, Game } from '../lib/types';

// Development catalog only. Counts, descriptions, and ordering are fixtures,
// not live Roblox data. Artwork is cropped from user-supplied design references.
export const games: Game[] = [
  {
    id: '2753915549',
    name: 'Blox Fruits',
    creator: 'Gamer Robot Inc',
    category: 'Adventure',
    image: 'blox-fruits',
    description:
      'Set sail for new islands. Train your abilities, discover powerful fruits, and find your next adventure on the open sea.',
    fixturePlayers: 428600,
    fixtureRating: 94,
  },
  {
    id: '4924922222',
    name: 'Brookhaven RP',
    creator: 'Brookhaven',
    category: 'Roleplay',
    image: 'brookhaven',
    description:
      'A place to call your own. Explore the town, meet friends, and create your own stories.',
    fixturePlayers: 319200,
    fixtureRating: 87,
  },
  {
    id: '13772394625',
    name: 'Blade Ball',
    creator: 'Wiggity',
    category: 'Action',
    image: 'blade-ball',
    description:
      'Stay focused, time your deflections, and be the last player standing in the arena.',
    fixturePlayers: 76200,
    fixtureRating: 93,
  },
  {
    id: '8737899170',
    name: 'Pet Simulator 99!',
    creator: 'BIG Games Pets',
    category: 'Simulation',
    image: 'pet-simulator',
    description:
      'Collect a team of colorful companions and explore a world full of surprises.',
    fixturePlayers: 68500,
    fixtureRating: 95,
  },
  {
    id: '10449761463',
    name: 'The Strongest Battlegrounds',
    creator: 'Yielding Arts',
    category: 'Action',
    image: 'battlegrounds',
    description:
      'Master your moves and test your skills in fast-paced battles.',
    fixturePlayers: 112400,
    fixtureRating: 92,
  },
  {
    id: '15101393044',
    name: 'Dress To Impress',
    creator: 'Dress To Impress Group',
    category: 'Roleplay',
    image: 'dress-to-impress',
    description:
      'Find your style, create a look, and take your turn on the runway.',
    fixturePlayers: 84200,
    fixtureRating: 91,
  },
  {
    id: '1962086868',
    name: 'Tower of Hell',
    creator: 'YXCeptional Studios',
    category: 'Obby',
    image: 'tower-of-hell',
    description:
      'Make your way to the top of a changing obstacle course. Every jump counts.',
    fixturePlayers: 24300,
    fixtureRating: 82,
  },
  {
    id: '920587237',
    name: 'Adopt Me!',
    creator: 'Uplift Games',
    category: 'Simulation',
    image: 'adopt-me',
    description: 'Raise pets, decorate a cozy home, and explore with friends.',
    fixturePlayers: 96300,
    fixtureRating: 85,
  },
  {
    id: '142823291',
    name: 'Murder Mystery 2',
    creator: 'Nikilis',
    category: 'Horror',
    image: 'murder-mystery',
    description:
      'Follow the clues, watch your surroundings, and solve the mystery.',
    fixturePlayers: 52800,
    fixtureRating: 90,
  },
  {
    id: '189707',
    name: 'Natural Disaster Survival',
    creator: 'Stickmasterluke',
    category: 'Adventure',
    image: 'natural-disaster',
    description:
      'Find shelter and think on your feet as the island faces a new disaster.',
    fixturePlayers: 14200,
    fixtureRating: 91,
  },
];
export const categories: Category[] = [
  'All games',
  'Adventure',
  'Roleplay',
  'Action',
  'Simulation',
  'Obby',
  'Horror',
];
export function filterGames(
  query: string,
  category: Category,
  sort: string,
  favorites?: string[],
) {
  return games
    .filter(
      (g) =>
        (!favorites || favorites.includes(g.id)) &&
        (category === 'All games' || g.category === category) &&
        `${g.name} ${g.creator}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'Name'
        ? a.name.localeCompare(b.name)
        : sort === 'Top rated'
          ? b.fixtureRating - a.fixtureRating
          : b.fixturePlayers - a.fixturePlayers,
    );
}
