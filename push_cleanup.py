import subprocess, os, glob

os.chdir(os.path.dirname(os.path.abspath(__file__)))

def run(cmd):
    print(f'  $ {cmd}')
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if r.stdout.strip(): print(r.stdout.rstrip())
    if r.stderr.strip(): print('[err]', r.stderr.rstrip()[:400])
    if r.returncode != 0: raise SystemExit(f'Failed: {cmd}')

print('--- Staging ---')
for f in [
    'backend/app/main.py',
    'backend/app/models.py',
    'backend/app/schemas.py',
    'backend/app/routers/dns.py',
    'frontend/src/pages/DnsPage.tsx',
]:
    run(f'git add "{f}"')

print('--- Commit ---')
staged = subprocess.run('git diff --cached --quiet', shell=True)
if staged.returncode != 0:
    msg = 'feat: per-device DNS policies with AdGuard client-rule sync'
    run(f'git commit -m "{msg}"')
else:
    print('  nothing to commit')

print('--- Push ---')
run('git push origin master')

print('--- Cleanup ---')
deleted = []
for pat in ['deploy_*.py', 'push_cleanup.py']:
    for f in glob.glob(os.path.join(os.getcwd(), pat)):
        os.remove(f)
        deleted.append(os.path.basename(f))
        print(f'  deleted {os.path.basename(f)}')
print(f'Done — {len(deleted)} scripts removed')
