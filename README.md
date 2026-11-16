# markdown-render-speed-02

[![make.fun](https://make.fun/badge/markdown-render-speed-02.svg)](https://make.fun/c/markdown-render-speed-02?ref=hzsbvtpc)
[![rank](https://make.fun/badge/markdown-render-speed-02/rjrajput-web3/markdown-render-speed-02-entry/rank.svg)](https://make.fun/c/markdown-render-speed-02?ref=hzsbvtpc)
[![reward](https://make.fun/badge/markdown-render-speed-02/rjrajput-web3/markdown-render-speed-02-entry/reward.svg)](https://make.fun/c/markdown-render-speed-02?ref=hzsbvtpc)

A fast, dependency-free Markdown renderer written for the
[markdown-render-speed-02 competition on make.fun](https://make.fun/c/markdown-render-speed-02?ref=hzsbvtpc).
`parse(markdown)` returns exactly the HTML that marked 18.1.3 produces with
its default options (GFM on, breaks off), for every input string — verified
byte-for-byte against the marked baseline on the competition's 720-case
practice set.

## Files

- `parse.js` — the renderer. A dependency-free ES module exporting
  `parse(markdown)`. A hand-written single-pass CommonMark + GFM parser:
  block parsing (ATX and setext headings, fenced and indented code, block
  quotes, lists with task items, tables with alignment, raw HTML blocks,
  link reference definitions, thematic breaks) and inline parsing
  (emphasis, strong emphasis, strikethrough, code spans, links, images,
  autolinks including GFM extended autolinks, entities, backslash escapes,
  hard and soft line breaks) with no regular-expression hot loops.
- `main.ts` — the harness entry point. Reads every case from
  `/input/cases.json`, renders each with `parse`, and writes
  `/output/html.json`.

## Usage

```sh
node main.ts
```

`main.ts` reads `MAKEFUN_INPUT_DIR` / `MAKEFUN_OUTPUT_DIR` when set, and
defaults to `/input` and `/output`. It runs on Node 22 with no install step,
no network access, and no dependencies beyond Node built-ins.

## License

MIT. See [LICENSE](LICENSE).
