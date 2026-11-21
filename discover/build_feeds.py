#!/usr/bin/env python3
"""Regenerate discover/feed.json (JSON Feed 1.1) and discover/feed.xml (RSS 2.0) from games.json. Run after every games.json edit."""
import json, os, html, email.utils, datetime
B = 'https://yoloboydelis.github.io/netnet-games/discover/'
here = os.path.dirname(os.path.abspath(__file__))
D = json.load(open(os.path.join(here, 'games.json')))
G = sorted([g for g in D['games'] if g['status'] == 'ok'], key=lambda g: (g['posted'], g['added']), reverse=True)[:50]
items = [dict(id=g['slug'], url=g['play_url'], external_url=g['x_post'], title=f"{g['title']} by {g['credit']}",
              content_text=f"{g['pitch']} Play: {g['play_url']} · X post: {g['x_post']}", date_published=g['posted'] + 'T00:00:00Z',
              tags=g['tags']) for g in G]
json.dump({"version": "https://jsonfeed.org/version/1.1", "title": "NetNet Arcade Discover: new browser games on X",
           "home_page_url": B, "feed_url": B + 'feed.json', "items": items}, open(os.path.join(here, 'feed.json'), 'w'), indent=1, ensure_ascii=False)
d = lambda s: email.utils.format_datetime(datetime.datetime.fromisoformat(s + 'T00:00:00+00:00'))
x = ''.join(f"<item><title>{html.escape(g['title'] + ' by ' + g['credit'])}</title><link>{html.escape(g['play_url'])}</link><guid isPermaLink=\"false\">netnet-discover-{g['slug']}</guid><pubDate>{d(g['posted'])}</pubDate><description>{html.escape(g['pitch'] + ' X post: ' + g['x_post'])}</description></item>" for g in G)
open(os.path.join(here, 'feed.xml'), 'w').write(f'<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>NetNet Arcade Discover: new browser games on X</title><link>{B}</link><description>Every new browser game shared on X, credited to its creator.</description><lastBuildDate>{d(D["updated"])}</lastBuildDate>{x}</channel></rss>\n')
print('feeds:', len(G), 'items')
