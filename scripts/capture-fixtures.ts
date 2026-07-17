import { mkdirSync, writeFileSync } from 'node:fs'
import { runBot } from '../e2e/bots/bot'

const frames: unknown[] = []
const stamp = Date.now()

const host = await runBot({
  name: `cap0_${stamp}`,
  opensBidding: true,
  onGame: g => frames.push(g),
})
await Promise.all(
  [1, 2, 3, 4].map(i => runBot({ name: `cap${i}_${stamp}`, gameId: host.gameId })),
)
await host.done

mkdirSync('fixtures', { recursive: true })
writeFileSync('fixtures/full-game.json', JSON.stringify(frames, null, 1))
console.log(`captured ${frames.length} broadcasts to fixtures/full-game.json`)
