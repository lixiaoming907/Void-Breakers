from pathlib import Path
import re

p = Path(r'E:\XiaomiMiMoProjects\2026-09-28\new-chat-2\虚空破阵-VOIDBREAKERS.html')
t = p.read_text(encoding='utf-8')
m = re.search(r'<script type="module">(.*)</script>', t, re.S)
body = m.group(1)
out = Path(r'E:\XiaomiMiMoProjects\2026-09-28\new-chat-2\voidbreakers\artifacts\inline-body.mjs')
out.write_text(body, encoding='utf-8')
print('wrote', out, 'len', len(body))

# Also print first 40 lines of HTML for structure
for i, line in enumerate(t.splitlines()[:25], 1):
    print(f'{i}: {line[:120]}')
print('...')
for i, line in enumerate(t.splitlines()[-8:], 1):
    print(f'tail{i}: {line[:120]}')
