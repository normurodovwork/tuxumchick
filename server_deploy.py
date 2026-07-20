import paramiko, sys

HOST, PORT, USER, PASSWORD = "176.101.56.77", 22, "root", "egglogisticb2b"
GH_TOKEN = "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"
APP_DIR = "/root/tuxumchick"

def ssh(cl, cmd, timeout=900):
    print(f"\n$ {cmd}", flush=True)
    _, o, e = cl.exec_command(cmd, timeout=timeout)
    out = (o.read() + e.read()).decode('utf-8', errors='replace').strip()
    out = out.replace(GH_TOKEN, "***")
    if out:
        print(out[:6000], flush=True)
    return out

print("Подключаюсь к серверу...", flush=True)
cl = paramiko.SSHClient()
cl.set_missing_host_key_policy(paramiko.AutoAddPolicy())
cl.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=15)
print("Подключён!\n", flush=True)

# GIT_ASKPASS
cl.exec_command(f"""cat > /tmp/gh_askpass.sh << 'EOF'
#!/bin/sh
echo "{GH_TOKEN}"
EOF
chmod +x /tmp/gh_askpass.sh""")

print("=== git pull ===", flush=True)
ssh(cl, f"cd {APP_DIR} && GIT_TERMINAL_PROMPT=0 GIT_ASKPASS=/tmp/gh_askpass.sh git pull origin main 2>&1", timeout=60)
ssh(cl, f"cd {APP_DIR} && git log --oneline -3")

# Фиксы
ssh(cl, f"find {APP_DIR} -name '*.sh' -exec sed -i 's/\\r//' {{}} \\; 2>/dev/null || true")
ssh(cl, f"chmod +x {APP_DIR}/Backend/docker-entrypoint.sh 2>/dev/null || true")
ssh(cl, f"cd {APP_DIR} && ln -sfn Backend backend && ln -sfn Frontend frontend 2>/dev/null || true")
ssh(cl, f"sed -i 's/RUN npm ci/RUN npm install/' {APP_DIR}/Frontend/Dockerfile")

print("\n=== docker compose up --build -d ===", flush=True)
ssh(cl, f"cd {APP_DIR} && docker compose up --build -d 2>&1", timeout=900)

print("\n=== Миграции БД ===", flush=True)
ssh(cl, "docker exec tuxumchick-backend-1 python manage.py migrate --noinput 2>&1", timeout=120)

print("\n=== Статус контейнеров ===", flush=True)
ssh(cl, "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'")

print("\n=== Backend логи ===", flush=True)
ssh(cl, f"cd {APP_DIR} && docker compose logs backend --tail=15 2>&1")

cl.exec_command("rm -f /tmp/gh_askpass.sh")
cl.close()

print("\n" + "="*50, flush=True)
print("ГОТОВО! http://176.101.56.77:3000", flush=True)
input("\nНажмите Enter для закрытия...")
