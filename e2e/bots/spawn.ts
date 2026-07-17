import { runBot, type BotHandle } from './bot'

export interface Bots {
  stop(): void
  allDone: Promise<void>
}

export async function spawnBots(gameId: string, count = 4): Promise<Bots> {
  const stamp = Date.now()
  const bots: BotHandle[] = []
  for (let i = 0; i < count; i++) {
    bots.push(await runBot({ name: `bot${i}_${stamp}`, gameId, opensBidding: i === 0 }))
  }
  return {
    stop: () => bots.forEach(b => b.stop()),
    allDone: Promise.all(bots.map(b => b.done)).then(() => undefined),
  }
}
