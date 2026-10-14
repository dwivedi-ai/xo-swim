# Sources

Everything in this folder is distilled from the material below. None of it was modified. The archive lives outside git on the machine where the design was made; paths are local.

Archive root: `/home/coder/xo-archive/2026-10-14/`, written below as `A/`. The full project snapshot is `A/xo-chat-ui-full-snapshot/`, written as `S/`.

## The session record

| File | What it is |
|---|---|
| `S/docs/handoff-2026-10-14.md` | The full session record (about 160 KB): chronology, design direction, principles, psychology, requirements, open questions. **The primary source for "why".** |
| `S/docs/requirements.md` | Backend requirements R1–R6 (resolve, review queue, project visibility, long tasks, history cursor, intelligence per session) |
| `A/ux-tests/FEEDBACK.md` | The design review log: every outcome and principle, round by round |
| `A/ux-tests/_review/comments.md` (and `.json`) | The 28 pinned review notes from the review canvas |

## The research

| File | What it is |
|---|---|
| `S/docs/human-ai-interaction-frontier.md` (= `S/reports/Human AI interaction frontier.md`) | The final report: "Stop typing to agents; start supervising them" |
| `S/research_notes/Human AI interaction frontier/human_nature.md` | The human-nature evidence base: 15 ranked truths, graded evidence, the ethics charter |
| `…/frontier_scan.md` | Products, research prototypes and adjacent fields reviewed |
| `…/ideas_space_body.md`, `ideas_time_senses.md`, `ideas_society_myth.md` | The three ideators' 49 concepts (SB1–16, TS1–16, SM1–17) |
| `…/finalists.md` | The grounding critic: scoring rubric, Keep/Merge/Drop, the seven finalist specs, the Decision Kit contract |
| `…/hooks_raw_ideas.md` | The raw catalogue of 195 engagement hooks in 19 families |
| `…/round2_brief.md`, `round2_texting_brief.md`, `round3_brief.md`, `round4_brief.md` | Each round's build brief |
| `…/round4_review.md` | The independent reviewer's measured audit of 14–16 and the proposed final product |
| `…/_context_product.md`, `_context_baby_research.txt`, `_context_baby_ai_loop.txt` | Shared context: the product, and text extracts of the Baby research |
| `S/docs/frontend-stack.md` (= `S/reports/Frontend stack for XO Cowork.md`) and `S/research_notes/Frontend stack for XO Cowork/` | The frontend-stack research behind "no framework for now" |

## The concepts

| Path | What it is |
|---|---|
| `A/ux-tests/NN-name/README.md` (01-round … 17-converged) | Each concept: what it is, how each note was addressed, keys, backend needs |
| `A/ux-tests/_shared/variants.json` | The registry of all 17: title, tagline, lens, port |
| `A/ux-tests/17-converged/` | The final candidate that became the shipped UI |
| `A/ux-tests/_hub/` | The review canvas used to inspect, measure and annotate every concept |
| `A/classic-ui/` | The classic UI the shipped design replaced (also tagged `classic-ui` in git) |

## Visual and design references

| File | What it is |
|---|---|
| `/home/coder/xo-space-architecture-chip.html` | XO Space's architecture diagram: the source of the palette, type scale and state glyphs |
| `/home/coder/baby/` (`baby-research.html`, `baby-ai-design-loop.html`, `baby-architecture*.html`) | The Baby design-tool research: the first set of human-centred principles ("instant, continuous, forgiving, the work is the hero…") |

## The shipped code (this repository)

| File | Design role |
|---|---|
| `css/tokens.css` | XO palette (dark, light, high contrast), Geist faces, type scale, radii, motion tokens |
| `css/app.css` | The UI, its second token layer (surfaces, grey ladder), the colour grammar comment at the top |
| `js/kit.js` | The Decision Kit: commit window, hold guard, risk, synthetic asks |
| `js/pacing.js` | Hold, bypass, ping, park, vigilance |
| `js/content.js` | Effort, leverage, ranking, suggestions, why-lines |
| `js/decide.js` | The Needs-you panel and the decision card |
| `js/intel.js` | The intelligence chip and popover |
| `js/night.js`, `js/finds.js`, `js/rules.js` | Demo-only: end of day, finds, rules |
| `js/ui.js` | Icons, the XO mark, the effort dial, morph and expand, sounds |

## Evidence references cited in this folder

As given in the archive (grades in brackets: A meta-analysis or robust replication, B peer-reviewed, C small or preprint, D practitioner). Full citations are in `human_nature.md`.

- **Attention and interruption**: Treisman & Gelade 1980 [A]; Abrams & Christ 2003 [B]; Simons & Levin 1998 [B]; Simons & Chabris 1999 [A]; Rensink, O'Regan & Clark 1997 [A]; Weiser & Brown 1995/96 [D]; Mankoff et al. 2003 [C]; Bailey & Konstan 2006 [B]; Iqbal & Bailey 2006 [B]; Iqbal & Horvitz 2007 [B]; Mark, González & Harris 2005 [B]; Mark, Gudith & Klocke 2008 [B]; Leroy 2009 [B]; Leroy & Glomb 2018 [B]; Rogers & Monsell 1995, Monsell 2003 [A]; Pu et al. CHI '25.
- **Memory and load**: Cowan 2001 [A]; Pylyshyn & Storm 1988 [A]; Sweller 1988 [A]; Kalyuga et al. 2003 [A]; Robertson et al. 1998, Czerwinski et al. 1999 [B]; Cockburn & McKenzie 2002 [B]; Dumais et al. 2003 [B]; Einstein & McDaniel [A].
- **Time and flow**: Csikszentmihalyi 1990 [A/B]; Miller 1968, Card et al. 1991 [A/D]; Buell & Norton 2011 [B]; Berberian et al. 2012 [B]; Rudd, Vohs & Aaker 2012 [B]; Keltner & Haidt 2003 [A].
- **Automation and trust**: Lee & See 2004 [A]; Parasuraman & Riley 1997 [A]; Bainbridge 1983 [A]; Endsley 1995 [A]; Onnasch et al. 2014 [A]; Goddard et al. 2012 [A]; Mosier & Skitka [B]; Bansal et al. 2021 [B]; Vasconcelos et al. 2023 [B]; Buçinca et al. 2021 [B]; Dietvorst et al. 2015, 2018 [B]; Dell'Acqua et al. 2023 [B]; Judge & Piccolo 2004 [A]; Brynjolfsson et al. 2023 [B]; METR 2025 RCT [I; flagged as withdrawn in the Baby research]; "The Work Behind Delegation", arXiv 2609.24234 [preprint].
- **Vigilance and labour**: Warm, Parasuraman & Matthews 2008 [A]; Hülsheger & Schewe 2011 [A]; FAA alerting research [I].
- **Conversation and social**: Stivers et al. 2009 [A]; Levinson & Torreira 2015 [A]; Clark & Brennan 1991 [A]; Nass & Moon 2000, Reeves & Nass 1996 [A]; Nass & Steuer 1993 [B]; Epley et al. 2007 [A]; Gray & Wegner 2012 [B, contested]; Yin, Jia & Wakslak 2024 [B]; Fang et al. 2025 [B/C].
- **Care**: Reis & Shaver 1988, Reis & Clark 2013 [A]; Cheng et al. 2025/26 [B+]; Ur et al. 2012 [B]; Shklovski et al. 2014 [B].
- **Motivation and habit**: Wood, Quinn & Kashy 2002 [B]; Lally et al. 2010 [C]; Ferster & Skinner 1957, Schultz et al. 1997 [A]; Ghibellini & Meier 2025 [A−]; Amabile & Kramer 2011 [B]; Ryan & Deci 2000 [A]; Deci, Koestner & Ryan 1999 [A]; Norton, Mochon & Ariely 2012 [B]; Nunes & Drèze 2006 [B]; Brown et al. 2024 [A]; Gray et al. 2018 [B]; Mathur et al. 2019 [B]; Allcott et al. 2020, 2022 [B].
- **Play and aesthetics**: Kao 2020, Kao et al. 2024 [B]; Kurosu & Kashimura 1995, Tractinsky et al. 2000 [B]; Heer & Robertson 2007 [B].
- **Individual differences**: Song et al. 2021 [A−]; Marco et al. 2011 [B]; Czaja et al. 2006 [B]; Chien et al. 2016 [B].

**Flagged as unverified in the archive's own notes**: Iqbal & Horvitz "27% > 2 h"; Dell'Acqua "19 percentage points"; Buçinca "least preferred"; Ayers "9.8×"; Mark "23 min 15 s" (an interview figure).
