from pathlib import Path
import re

p = Path(r'E:\XiaomiMiMoProjects\2026-09-28\new-chat-2\虚空破阵-VOIDBREAKERS.html')
t = p.read_text(encoding='utf-8')
print('len', len(t))
print('script open', t.count('<script'))
print('style open', t.count('<style'))
print('script close', t.count('</script'))
print('style close', t.count('</style'))

idx = t.find('<script type="module">')
print('script idx', idx)
print('around', repr(t[idx:idx + 100]))

m = re.search(r'<script type="module">(.*)</script>', t, re.S)
if m:
    body = m.group(1)
    print('body len', len(body))
    print('body has script-close-text', '</script' in body)
    print('body start', repr(body[:80]))
    print('body end', repr(body[-80:]))
else:
    print('no script body match')
    # maybe multiple script closes
    print('all script closes at', [m.start() for m in re.finditer('</script', t)])
