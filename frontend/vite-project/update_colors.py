import os

file_path = r"c:\Users\23536\OneDrive\Desktop\Akash\Project02 - SQl Server tool\frontend\vite-project\src\components\ObjectBrowser.css"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('#fff', 'var(--bg-panel)')
content = content.replace('#f5f5f5', 'var(--bg-body)')
content = content.replace('#0078d4', 'var(--color-primary)')
content = content.replace('#333', 'var(--text-main)')
content = content.replace('#666', 'var(--text-secondary)')
content = content.replace('#999', 'var(--text-muted)')
content = content.replace('#e0e0e0', 'var(--border-color)')
content = content.replace('#ddd', 'var(--border-light)')
content = content.replace('#f0f0f0', 'var(--bg-hover)')
content = content.replace('#e8e8e8', 'var(--bg-hover)')
content = content.replace('#e3f2fd', 'var(--bg-active)')

# specific replacements for white
content = content.replace('background: white;', 'background: var(--bg-panel);')
content = content.replace('background: white', 'background: var(--bg-panel)')
# But for color: white, it should stay white or use var(--bg-panel) depending on context. Active tab text is usually --bg-panel on primary background. Let's leave color: white as is, or change to var(--bg-panel).
content = content.replace('color: white;', 'color: var(--bg-panel);')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
