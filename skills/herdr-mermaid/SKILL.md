---
name: herdr-mermaid
description: Use whenever you are about to show a mermaid diagram while running inside a herdr pane (HERDR_ENV=1). Produces the ```mermaid block through `herdr-mermaid emit` so the daemon can overlay the rendered picture at readable size.
---

# herdr-mermaid

Inside herdr, a background daemon renders every ```mermaid block you emit and draws the
picture over the block itself, following it as the pane scrolls. It needs the block to be
tall enough for the picture, and it must be able to find the block on screen. Both come
from `emit`.

## Procedure

1. Write the diagram source to a file, e.g. `~/.cache/herdr-mermaid/<pane>/<name>.mmd`
   (any path works; do not put `%%` comments on the first line).
2. Run `"${CLAUDE_PLUGIN_ROOT}/bin/herdr-mermaid" emit FILE.mmd`.
   stdout is the finished block: the source, `%%` padding lines, and a final
   `%% herdr-mermaid` line, wrapped in a ```mermaid fence. stderr reports the row count.
3. Paste stdout verbatim as the **last** content of your message. Text goes above it.

## Rules

- Never write a ```mermaid block by hand; the Stop hook sends the turn back if the final
  `%% herdr-mermaid` line is missing or the block is not last.
- Do not quote the block, its first lines, or its padding in prose: the daemon finds the
  block by matching its first three source lines on screen.
- One diagram per message. The pane shows one picture at a time (the newest visible block).
- Not in herdr (`HERDR_ENV` unset)? Emit mermaid normally; none of this applies.

## What the reader gets

- The picture is fitted to the pane width; `emit` sizes the block so the picture is not
  shrunk below that. Width is the hard limit: a very wide diagram in a narrow pane stays small.
- `prefix+m` (if the user bound it) toggles a full-pane zoom of the visible diagram.
