from pathlib import Path

root = Path(r'E:\XiaomiMiMoProjects\2026-09-28\new-chat-2\voidbreakers')
body = (root / 'artifacts' / 'inline-body.mjs').read_text(encoding='utf-8')
print('doctype in body', '<!doctype' in body.lower())
print('html tag in body', '<html' in body.lower())
print('body lines', body.count('\n'))
# show line 6 start/end
lines = body.splitlines()
print('num lines', len(lines))
for i in range(min(8, len(lines))):
    print(i + 1, 'len', len(lines[i]), 'start', repr(lines[i][:60]), 'end', repr(lines[i][-40:]))

# find if doctype is on some line
for i, line in enumerate(lines):
    if '<!doctype' in line.lower() or '<html' in line.lower():
        print('found markup at line', i + 1, 'pos', line.lower().find('<!doctype'), repr(line[max(0, line.lower().find('<!doctype') - 20):line.lower().find('<!doctype') + 40]))

# compare sizes to original js
js = next((root / 'dist' / 'assets').glob('*.js'))
js_text = js.read_text(encoding='utf-8')
print('orig js bytes', len(js_text), 'body bytes', len(body))
print('orig doctype', '<!doctype' in js_text.lower())
print('diff', len(js_text) - len(body))
