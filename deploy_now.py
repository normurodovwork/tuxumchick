import subprocess, paramiko, os, sys

PROJECT   = r"C:\Users\user\Desktop\TuxumChick"
GH_TOKEN  = "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"
GH_REMOTE = "https://normurodovwork:" + GH_TOKEN + "@github.com/normurodovwork/tuxumchick.git"
HOST, PORT, USER, PASSWORD = "176.101.56.77", 22, "root", "egglogisticb2b"
APP_DIR   = "/root/tuxumchick"
LOG       = os.path.join(PROJECT, "deploy_now_result.txt")

lines = []
def log(m):
    print(m, flush=True)
    lines.append(str(m))
    with open(LOG, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

def local(cmd, allow_fail=False):
    log("\n[LOCAL] " + cmd)
    r = subprocess.run(cmd, shell=True, cwd=PROJECT, capture_output=True, text=True,
                       encoding='utf-8', errors='replace')
    out = (r.stdout + r.stderr).strip().replace(GH_TOKEN, "***")
    log(out[:3000] or '(no output)')
    if r.returncode != 0 and not allow_fail:
        log("ОШИБКА (код " + str(r.returncode) + ")")
    return r.returncode

def ssh(cl, cmd, timeout=900, hide=False):
    log("\n[SSH] " + ("***" if hide else cmd))
    _, o, e = cl.exec_command(cmd, timeout=timeout)
    out = (o.read() + e.read()).decode('utf-8', errors='replace').strip().replace(GH_TOKEN, "***")
    log(out[:8000] or '(no output)')
    return out

log("=" * 60)
log("ШАГ 1: Подготовка git")
log("=" * 60)

# Удалить lock-файлы если есть
for lock in ["index.lock", "HEAD.lock"]:
    lf = os.path.join(PROJECT, ".git", lock)
    if os.path.exists(lf):
        try:
            os.remove(lf)
            log("Удалён: " + lf)
        except Exception as ex:
            log("Не удалось удалить " + lock + ": " + str(ex))

local("git config user.email worknormurodov@gmail.com", allow_fail=True)
local("git config user.name Dilmurod", allow_fail=True)
local("git remote set-url origin " + GH_REMOTE, allow_fail=True)

log("\n" + "=" * 60)
log("ШАГ 2: git commit & push")
log("=" * 60)

local("git add -A")

rc = local('git commit -m "Expense model + UI updates"', allow_fail=True)
if rc == 1:
    log("(нечего коммитить — продолжаем)")

rc = local("git push origin main")
if rc != 0:
    log("ОШИБКА push! Прерываю.")
    input("Enter для выхода")
    sys.exit(1)
log("\n✓ Push выполнен!")

log("\n" + "=" * 60)
log("ШАГ 3: SSH деплой на сервер")
log("=" * 60)

cl = paramiko.SSHClient()
cl.set_missing_host_key_policy(paramiko.AutoAddPolicy())
cl.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=15)
log("Подключён к серверу!")

ssh(cl, "cat > /tmp/gh_askpass.sh << 'EOF'\n#!/bin/sh\necho '" + GH_TOKEN + "'\nEOF\nchmod +x /tmp/gh_askpass.sh", hide=True)

log("\n--- git pull ---")
ssh(cl, "cd " + APP_DIR + " && GIT_TERMINAL_PROMPT=0 GIT_ASKPASS=/tmp/gh_askpass.sh git pull origin main 2>&1", timeout=60)
ssh(cl, "cd " + APP_DIR + " && git log --oneline -3", timeout=30)

ssh(cl, "find " + APP_DIR + r" -name '*.sh' -exec sed -i 's/\r//' {} \; 2>/dev/null || true")
ssh(cl, "chmod +x " + APP_DIR + "/Backend/docker-entrypoint.sh 2>/dev/null || true")
ssh(cl, "cd " + APP_DIR + " && ln -sfn Backend backend && ln -sfn Frontend frontend 2>/dev/null || true")
ssh(cl, "sed -i 's/RUN npm ci/RUN npm install/' " + APP_DIR + "/Frontend/Dockerfile 2>/dev/null || true")

log("\n--- docker compose up --build -d ---")
ssh(cl, "cd " + APP_DIR + " && docker compose up --build -d 2>&1", timeout=900)

log("\n" + "=" * 60)
log("ШАГ 4: Миграции БД")
log("=" * 60)

ssh(cl, "docker exec tuxumchick-backend-1 python manage.py migrate --noinput 2>&1", timeout=120)

log("\n--- Статус контейнеров ---")
ssh(cl, "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'")

log("\n--- Backend логи (последние 15) ---")
ssh(cl, "cd " + APP_DIR + " && docker compose logs backend --tail=15 2>&1")

ssh(cl, "rm -f /tmp/gh_askpass.sh", hide=True)
cl.close()

log("\n" + "=" * 60)
log("✓ ГОТОВО!")
log("  Сайт:  http://176.101.56.77:3000")
log("  Admin: http://176.101.56.77:8000/admin")
log("=" * 60)
input("\nНажмите Enter для закрытия...")
