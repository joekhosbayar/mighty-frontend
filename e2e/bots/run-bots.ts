import { spawnBots } from './spawn'

const gameId = process.argv[2]
if (!gameId) {
  console.error('usage: npm run bots -- <gameId>')
  process.exit(1)
}

const bots = await spawnBots(gameId, 4)
console.log(`4 bots joined game ${gameId}; playing until finished…`)
await bots.allDone
console.log('game finished')
