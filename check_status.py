import paramiko, os

HOST, PORT, USER, PASSWORD = "176.101.56.77", 22, "root", "egglogisticb2b"
LOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "check_status_result.txt")

lines = []
def log(m):
    print(m, flush=True)
    lines.append(str(m))
    with open(LOG, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

cl = paramiko.SSHClient()
cl.set_missing_host_key_policy(paramiko.AutoAddPolicy())
cl.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=15)
log("Подключён к серверу!")

def ssh(cmd, timeout=30):
    log(f"\n$ {cmd}")
    _, o, e = cl.exec_command(cmd, timeout=timeout)
    out = (o.read() + e.read()).decode('utf-8', errors='replace').strip()
    log(out or '(нет вывода)')
    return out

log("\n=== Статус контейнеров ===")
ssh("docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'")

log("\n=== Последний коммит на сервере ===")
ssh("cd /root/tuxumchick && git log --oneline -3")

log("\n=== Таблицы в БД ===")
ssh("docker exec tuxumchick-db-1 psql -U postgres -d tuxumchick -c \"\\dt\" 2>&1")

log("\n=== Backend логи (последние 20) ===")
ssh("docker logs tuxumchick-backend-1 --tail=20 2>&1", timeout=15)

cl.close()
log("\n=== ГОТОВО ===")
input("\nНажмите Enter для закрытия...")
