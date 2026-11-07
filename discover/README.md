# Discover: daily "New on X" update procedure

Single source of truth: `discover/games.json` (`originals[]` = NetNet aidunlap games, `games[]` = community games).
The page, the claim page, the feeds and the Worker claim list are all generated from it.

## Fields (community game)
`slug` (unique, kebab), `title`, `creator` (X handle, no @), `credit` (display, e.g. `@handle` or `shared by @x (made by y)`),
`x_post` (launch post URL), `play_url` (creator's own site), `posted` (post date, UTC YYYY-MM-DD, drives NEW badge <7 days),
`added` (date we listed it), `tags` (lowercase: arcade, racing, sports, multiplayer, shooter, puzzle, strategy, cards, survival,
action, adventure, casual, physics, story, trivia, 3d, vibe-coded...), `genre`, `pitch` (<=90 chars, our own words),
`thumbnail` ("" = emoji tile; never hotlink/copy creator art without OK), `likes`/`reposts`/`views` (snapshot), `status` (`ok` | `down` | `removed`), `kind` = `community`.

## 1. Scan X (x namespace `search_posts_all`, max 25 results/call, 30 reads/min, 1000/day)
`start_time` = yesterday 00:00Z, `sort_order: relevancy`, `post.fields: created_at,public_metrics,entities,author_id`, `expansions: author_id`, `user.fields: username`. Queries:
- `#NetNetArcade has:links -is:retweet`  (submissions, check first)
- `("vibe coded" OR vibecoded OR "made a game" OR "built a game") (play OR "try it") has:links -is:retweet`
- `("play it here" OR "play free" OR "play in your browser" OR "no download") game has:links -is:retweet`
- `(#vibejam OR "browser game" OR "built with claude" OR "built with cursor" OR "made with grok" OR "three.js game") game has:links -is:retweet`
- replies with links under NetNet Arcade posts (once the account exists): `conversation_id:<post id> has:links`
Resolve t.co links: `curl -s -o /dev/null -w '%{url_effective} %{http_code}' -L -m 20 -A 'Mozilla/5.0' <t.co>`.

## 2. Filters (all must pass)
- Final URL returns 200 and the game plays in the browser (itch.io must show "Run game"/html_embed). No Steam/App Store/download-only, no GitHub repo-only, no studio homepages, no "platform" ads.
- Original IP. Exclude ports/remakes or names of brands they don't own (Nintendo, Pokémon, Mario, Hot Wheels, Tesla, real football clubs/leagues, etc.).
- No NSFW, gambling/casino, token/airdrop/scam funnels, dating content.
- Dedupe by `slug`, `x_post` and `play_url` against games.json. Credit the maker; if the poster is a reposter, say `shared by @x (made by y)`.
- Never rehost, embed or copy the game. Link out only. Removal requests from the claim page win immediately (set `status: "removed"`).

## 3. Append and rebuild
1. Append objects to `games[]`, set `updated` to today.
2. `python3 discover/build_feeds.py` -> regenerates `feed.json` + `feed.xml`.
3. `cd server && npm test` (regenerates `src/discover-games.js` from games.json, used by the claim checks), then `CLOUDFLARE_API_TOKEN=<token> npm run deploy` so new games can be claimed.
4. Local check: `python3 -m http.server 8765` in netnet-site, then `node /workspace/pltest/d2.js` (desktop+mobile counts, search, tags, claim, no JS errors).
5. Push to `main` of yoloboydelis/netnet-games with GitHub `push_files` (max 4 files per call: games.json, feed.json, feed.xml, + index.html if changed); wait for the gh-pages publish before the next push.
6. Re-run the check against the live URL: `node /workspace/pltest/d2.js https://yoloboydelis.github.io/netnet-games/ -live`.

Never post, reply or DM on X as part of this routine.
