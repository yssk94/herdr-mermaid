import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Diagram } from '../types'

const diagrams = atom({ plugin: 'herdr-mermaid', key: 'diagrams' } as const, {})

const FENCE = /^```mermaid[ \t]*\n([\s\S]*?)\n```[ \t]*$/gm
// Terminal cells are about twice as tall as wide; CSS px per column at a readable size.
const CELL_ASPECT = 0.5
const PX_PER_COLUMN = 8
// Claude Code draws no Markdown element longer than this.
const MARKDOWN_MAX = 10_000

type Part = { kind: 'text'; text: string } | { kind: 'mermaid'; src: string; fence: string }

export const split = (text: string): Part[] => {
  const parts: Part[] = []
  let at = 0
  for (const m of text.matchAll(FENCE)) {
    const before = text.slice(at, m.index).replace(/^\n+|\s+$/g, '')
    if (before !== '') parts.push({ kind: 'text', text: before })
    parts.push({ kind: 'mermaid', src: m[1] ?? '', fence: m[0] })
    at = m.index + m[0].length
  }
  const rest = text.slice(at).replace(/^\n+|\s+$/g, '')
  if (rest !== '') parts.push({ kind: 'text', text: rest })
  return parts
}

// Fits the picture into the pane width, then derives rows from its aspect ratio.
export const fit = (width: number, height: number, maxColumns: number) => {
  let columns = Math.max(1, Math.min(maxColumns, 255, Math.ceil(width / PX_PER_COLUMN)))
  let rows = Math.round(((columns * height) / width) * CELL_ASPECT)
  if (rows > 255) {
    columns = Math.max(1, Math.floor((columns * 255) / rows))
    rows = 255
  }
  return { columns, rows: Math.max(1, rows) }
}

const inflight = new Set<string>()

const render = async ($: EngineInterface, src: string) => {
  inflight.add(src)
  let result: Diagram
  try {
    const run = await $.process.run([`${$.plugin.root}/bin/render-mermaid`], {
      stdin: src,
      timeoutMs: 60_000,
    })
    result =
      run.exitCode !== 0
        ? { state: 'failed', reason: run.stderr.trim().split('\n').pop() || `exit ${run.exitCode}` }
        : run.isStdoutTruncated
          ? { state: 'failed', reason: 'rendered image is too large' }
          : { state: 'ready', ...(JSON.parse(run.stdout) as { png: string; width: number; height: number }) }
  } catch (error) {
    result = { state: 'failed', reason: error instanceof Error ? error.message : String(error) }
  }
  try {
    await update($, diagrams, all => ({ ...all, [src]: result }))
  } finally {
    inflight.delete(src)
  }
}

export const register: Register = on => {
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (e.surface !== 'terminal') {
      return next(e)
    }
    const parts = split(e.props.text)
    if (
      !parts.some(part => part.kind === 'mermaid') ||
      parts.some(part => part.kind === 'text' && part.text.length > MARKDOWN_MAX)
    ) {
      return next(e)
    }
    const known = await read($, diagrams)
    for (const part of parts) {
      if (part.kind === 'mermaid' && known[part.src] === undefined && !inflight.has(part.src)) {
        void render($, part.src)
      }
    }
    const { Box, Markdown, Text, Image } = $.ui.resolve(e)
    const maxColumns = Math.max(1, (e.viewport?.columns ?? 80) - 4)

    return (
      <Box flexDirection="column">
        {parts.map((part, i) => {
          if (part.kind === 'text') {
            return <Markdown key={`t${i}`} text={part.text} />
          }
          const diagram = known[part.src]
          if (diagram?.state === 'ready') {
            const { columns, rows } = fit(diagram.width, diagram.height, maxColumns)
            return (
              <Image
                key={`m${i}`}
                source={{ png: diagram.png }}
                columns={columns}
                rows={rows}
                alt="[mermaid diagram]"
              />
            )
          }
          return (
            <Box key={`m${i}`} flexDirection="column">
              <Markdown text={part.fence} />
              {diagram?.state === 'failed' && <Text dimColor>mermaid: {diagram.reason}</Text>}
            </Box>
          )
        })}
      </Box>
    )
  })
}
