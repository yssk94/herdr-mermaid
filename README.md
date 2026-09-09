# herdr-mermaid

Claude Code plugin that renders the mermaid diagrams Claude emits and draws them over their own
code blocks inside a [herdr](https://herdr.dev/) pane, following the block as the conversation
scrolls. The terminal keeps rendering plain text; the picture is a herdr graphics layer placed
with direct-kitty file frames, so moving it costs one JSON line (about 5 ms).

## Requirements

| Requirement | Why |
|---|---|
| herdr 0.9 or newer, attached from a local Ghostty, kitty or WezTerm | `pane.graphics.stream` with `direct-kitty` file transport |
| Google Chrome or Chromium (`HERDR_MERMAID_CHROME` to override the path) | mermaid is rendered headless; Chrome also decodes the screenshot to raw pixels |
| Python 3.9 or newer | the tool is a single standard-library script |
| Claude Code with plugin hooks and skills (verified on 2.1.266) | the daemon is started by a `SessionStart` hook and the block format is enforced by a `Stop` hook |
| macOS or Linux | Windows herdr is beta and untested here |

`vendor/mermaid.min.js` is bundled (MIT, see `vendor/mermaid.LICENSE`). Nothing is fetched at
run time and diagram content never leaves the machine.

## Install

Unpack or clone the directory anywhere, then link it into Claude Code's skills directory.
Everything under `~/.claude/skills/` loads as a plugin at the start of every session, hooks included:

```bash
ln -s /path/to/herdr-mermaid ~/.claude/skills/herdr-mermaid
claude plugin details herdr-mermaid@skills-dir     # should list 1 skill and 3 hooks
```

Alternatives: `claude --plugin-dir /path/to/herdr-mermaid` for one session, or
`claude plugin marketplace add /path/to/herdr-mermaid` followed by `claude plugin install herdr-mermaid@herdr-mermaid`.

If `emit` or the daemon log says herdr reports no direct-kitty file transport, detach and
reattach the herdr client once (`ctrl+b q`, then `herdr`); herdr renegotiates graphics support
on attach.

Optional herdr keybinding for the zoom toggle (`~/.config/herdr/config.toml`):

```toml
[[keys.command]]
key = "prefix+m"
type = "shell"
command = "pkill -USR1 -f 'herdr-mermaid daemon'"
description = "toggle diagram zoom"
```

## How it works

| Piece | Role |
|---|---|
| `SessionStart` hook | starts `herdr-mermaid daemon` for the pane with the session's transcript path; the daemon exits when Claude Code does |
| daemon | tails the transcript for ```mermaid blocks, renders each with Chrome, finds the block on screen via `pane.read`, overlays the picture, re-renders on pane resize |
| `emit` | pads a ```mermaid block so the picture fits the pane width; Claude pastes it as the last content of a message |
| `UserPromptSubmit` hook | reminds Claude of the procedure every turn |
| `Stop` hook | sends the turn back when a mermaid block was written by hand or is not last |
| `SIGUSR1` | toggles a letterboxed full-pane zoom of the visible diagram |

State lives in `~/.cache/herdr-mermaid/<pane>/` (log, pid, render scratch). Frame files go
to herdr's own `file_frame_directory` and are removed on exit.

## Known limits

- A block whose first row has scrolled above the pane is hidden rather than clipped
  (herdr paints negative offsets over the tab bar).
- One picture per pane at a time: the newest visible block wins.
- The picture never exceeds the pane width; padding gives it height, not width.
- Re-rendering after a resize takes 1 to 3 s (three headless Chrome launches).
- Blocks are matched by their first three source lines; two diagrams with identical
  first three lines in one session are treated as the same block.

## Development

```bash
bin/herdr-mermaid self-check
bin/herdr-mermaid emit examples/sequence.mmd     # inside a herdr pane
tail -f ~/.cache/herdr-mermaid/*/daemon.log
```
