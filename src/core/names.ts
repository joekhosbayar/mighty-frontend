const ADJECTIVES = [
  'Golden', 'Crimson', 'Midnight', 'Velvet', 'Ivory', 'Emerald',
  'Sapphire', 'Obsidian', 'Ruby', 'Silver', 'Royal', 'Noble',
  'Grand', 'Silent', 'Secret', 'Hidden', 'Opal', 'Marble',
  'Copper', 'Bronze', 'Brass', 'Crystal', 'Jade', 'Amethyst'
]

const NOUNS = [
  'Lion', 'Crown', 'Shield', 'Sword', 'Chalice', 'Diamond',
  'Spade', 'Heart', 'Club', 'Joker', 'Monarch', 'Knight',
  'Room', 'Lounge', 'Parlor', 'Sanctum', 'Vault', 'Court',
  'Throne', 'Dragon', 'Phoenix', 'Raven', 'Wolf', 'Bear'
]

export function getTableName(gameId: string): string {
  // Simple djb2 hash algorithm
  let hash = 5381
  for (let i = 0; i < gameId.length; i++) {
    hash = ((hash << 5) + hash) + gameId.charCodeAt(i)
  }
  
  // Ensure positive number for array indexing
  const positiveHash = Math.abs(hash)
  
  const adjIndex = positiveHash % ADJECTIVES.length
  // Use a different part of the hash for the noun to ensure variation
  const nounIndex = Math.floor(positiveHash / ADJECTIVES.length) % NOUNS.length
  
  return `The ${ADJECTIVES[adjIndex]} ${NOUNS[nounIndex]}`
}
