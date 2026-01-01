# herdr-mermaid

Claude Code mod that draws the mermaid diagrams in Claude's replies as images, in place of
their code blocks. The picture is part of the transcript: it scrolls, wraps and clips with the
text around it, in herdr panes and in a plain Ghostty or kitty window alike.

## Requirements
1960
| Requirement                                                                                     | Why                                                                                                             |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| A terminal with kitty graphics: Ghostty, kitty 0.28+, or herdr 0.9.2+ attached from one of them | Claude Code draws the picture with kitty graphics unicode placeholders                                          |
| `CLAUDE_CODE_FORCE_TERMINAL_IMAGES=1` inside herdr                                              | Claude Code only enables images when the terminal reports itself as `ghostty` or `kitty`; herdr reports `herdr` |
| Google Chrome or Chromium (`HERDR_MERMAID_CHROME` to override the path)                         | mermaid is rendered in headless Chrome                                                                          |
| Python 3.9 or newer                                                                             | `bin/render-mermaid` is a single standard-library script                                                        |
| Claude Code with function-hook mods (verified on 2.1.289)                                       | the mod hooks `ui.render` for `AssistantMessage`                                                                |

`vendor/mermaid.min.js` is bundled (MIT, see `vendor/mermaid.LICENSE`). Nothing is fetched at
run time and diagram content never leaves the machine.

## Install

```bash
claude plugin marketplace add yssk94/herdr-mermaid
claude plugin install herdr-mermaid@herdr-mermaid
```

Inside herdr, also set the variable in `~/.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_FORCE_TERMINAL_IMAGES": "1"
  }
}
```

Set it only where every terminal you start Claude Code from supports kitty graphics;
elsewhere it prints the image escape sequences as text.

For development, `claude --plugin-dir /path/to/herdr-mermaid` loads a checkout for one session.

## How it works

| Piece                | Role                                                                                                                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hooks/register.tsx` | on every assistant message drawn in a terminal, splits the text around its ```mermaid blocks, draws the text as markdown and each rendered block as an `Image` sized to the pane width and the picture's aspect ratio |
| `bin/render-mermaid` | mermaid source on stdin, `{"png", "width", "height"}` on stdout; renders with headless Chrome at 2x and caches the PNG in `~/.cache/herdr-mermaid/` by source                                                         |

A block is shown as its source while it renders (about 6 s for a new diagram, instant from the
cache) and stays as source, with the reason underneath, when mermaid rejects it.
Other surfaces (desktop, VS Code, mobile) and replies without mermaid are left to Claude Code.

## Known limits

- The reply's leading bullet is not drawn on a message that contains a diagram.
- Only fences that start a line as ```` ```mermaid ```` are drawn; indented fences (inside a list item), `~~~` fences
  and fences of four backticks stay as source.
- A reply whose text around a diagram runs past 10000 characters is left as source.
- A diagram whose PNG exceeds 2 MiB at 2x is taken at 1x; one that still exceeds it stays as source.
- A diagram that failed to render is not retried in the same session.
- Rows are derived assuming terminal cells twice as tall as wide; other fonts stretch the picture slightly.
- A picture is at most 255 columns by 255 rows.

## Development

```bash
claude plugin validate .
claude plugin test .
bin/render-mermaid < examples/sequence.mmd | head -c 200
```
