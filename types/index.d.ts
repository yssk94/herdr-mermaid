export type Diagram =
  | { state: 'ready'; png: string; width: number; height: number }
  | { state: 'failed'; reason: string }

declare module 'claude-code' {
  interface PluginState {
    'herdr-mermaid': { diagrams: Record<string, Diagram> }
  }
}
