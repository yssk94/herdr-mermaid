import type { ProcessRunResult } from 'claude-code'
import { describe, expect, test } from 'claude-code/testing'

import { fit, split } from '../hooks/register'

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const reply = 'before\n\n```mermaid\ngraph TD\n  A-->B\n```\n\nafter'
const props = { text: reply, isFirstOfReply: true }

const ran = (exitCode: number, stdout: string, stderr = ''): { value: ProcessRunResult } => ({
  value: { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false },
})

describe('split', () => {
  test('keeps the text around each mermaid block in order', () => {
    expect(split(reply)).toEqual([
      { kind: 'text', text: 'before' },
      { kind: 'mermaid', src: 'graph TD\n  A-->B', fence: '```mermaid\ngraph TD\n  A-->B\n```' },
      { kind: 'text', text: 'after' },
    ])
  })

  test('leaves other code blocks as text', () => {
    expect(split('```ts\nconst a = 1\n```')).toEqual([{ kind: 'text', text: '```ts\nconst a = 1\n```' }])
  })
})

describe('fit', () => {
  test('sizes from the picture and keeps its aspect in cells', () => {
    expect(fit(400, 200, 120)).toEqual({ columns: 50, rows: 13 })
  })

  test('narrows to the pane and to 255 rows', () => {
    expect(fit(1600, 400, 100)).toEqual({ columns: 100, rows: 13 })
    expect(fit(200, 5000, 100)).toEqual({ columns: 20, rows: 255 })
  })
})

test('a rendered block becomes an Image between its text', async ($, on) => {
  const calls: (readonly string[])[] = []
  on('process.run', (_$, e) => {
    calls.push(e.argv)
    return ran(0, JSON.stringify({ png: PNG, width: 400, height: 200 }))
  })
  const ui = await $.ui.mount({ plugin: 'herdr-mermaid', surface: 'terminal', component: 'AssistantMessage', props })
  await ui.redraw()
  expect(calls.length).toBe(1)
  expect(calls[0]?.[0]).toMatch(/\/bin\/render-mermaid$/)
  expect(await ui.find({ type: 'Image', key: 'm1' })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /before/ })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /after/ })).toBeDefined()
})

test('a failed render keeps the source and says why', async ($, on) => {
  on('process.run', () => ran(1, '', 'mermaid render failed: Parse error on line 2'))
  const ui = await $.ui.mount({ plugin: 'herdr-mermaid', surface: 'terminal', component: 'AssistantMessage', props })
  await ui.redraw()
  expect(await ui.find({ type: 'Markdown', text: /```mermaid/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Parse error on line 2/ })).toBeDefined()
})

test('other surfaces and replies without mermaid are left to the engine', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  const desktop = await $.ui.mount({ plugin: 'herdr-mermaid', surface: 'desktop', component: 'AssistantMessage', props })
  expect(await desktop.find({ type: 'Text', text: /engine/ })).toBeDefined()
  const plain = await $.ui.mount({
    plugin: 'herdr-mermaid',
    surface: 'terminal',
    component: 'AssistantMessage',
    props: { text: 'no diagram', isFirstOfReply: true },
  })
  expect(await plain.find({ type: 'Text', text: /engine/ })).toBeDefined()
})
