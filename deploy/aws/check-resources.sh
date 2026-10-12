#!/usr/bin/env bash
set -euo pipefail

compose_file="${1:-docker-compose.aws.yml}"
env_file="${2:-deploy/aws/aws.env}"
compose=(docker compose --env-file "$env_file" -f "$compose_file" --profile app)

echo "== Host =="
date --iso-8601=seconds
uptime
free -h
swapon --show
df -h /

echo
echo "== Containers =="
"${compose[@]}" ps
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.PIDs}}'

echo
echo "== State / OOM =="
for service in mysql backend; do
  container_id="$("${compose[@]}" ps -q "$service" 2>/dev/null || true)"
  if [[ -z "$container_id" ]]; then
    printf '%s: not running\n' "$service"
    continue
  fi
  docker inspect --format \
    'service={{ index .Config.Labels "com.docker.compose.service" }} status={{ .State.Status }} health={{ if .State.Health }}{{ .State.Health.Status }}{{ else }}n/a{{ end }} oom_killed={{ .State.OOMKilled }} restarts={{ .RestartCount }} exit_code={{ .State.ExitCode }}' \
    "$container_id"
done

echo
echo "== Kernel OOM events (last 24 hours) =="
journalctl -k --since '-24 hours' --no-pager 2>/dev/null \
  | grep -Ei 'out of memory|oom-kill|killed process' \
  || echo 'No OOM events found.'
