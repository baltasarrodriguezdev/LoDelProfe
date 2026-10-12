# Lo del Profe en AWS EC2

Configuracion de prueba para una EC2 `t3.micro` con aproximadamente 908 MiB de RAM utilizable y 2 GiB de swap.

## Decisiones de seguridad y recursos

- MySQL no publica puertos y solo pertenece a la red interna `private_db`.
- El backend publica exclusivamente `127.0.0.1:3000` para que lo consuma Cloudflare Tunnel o un proxy local.
- El backend pertenece al profile `app`: un `docker compose up -d` normal no lo inicia.
- El comando del backend es solo `node dist/src/server.js`; no ejecuta migraciones automaticamente.
- No hay Redis: el runtime actual usa eventos locales y polling, no `ioredis` ni WebSocket.
- `mem_limit` es un techo, no una reserva ni consumo constante. Los techos suman 704 MiB; el uso normal esperado debe ser bastante menor.
- MySQL puede usar hasta 416 MiB de RAM y 640 MiB combinando RAM y swap.
- Node puede usar hasta 288 MiB de RAM y 448 MiB combinando RAM y swap. El heap V8 comienza limitado a 160 MiB para dejar margen a Prisma, buffers y librerias nativas.
- Los logs de cada contenedor rotan a 10 MiB y conservan tres archivos.
- El volumen `lodelprofe_aws_mysql_data` es independiente del volumen de Docker Desktop de Windows.

## Archivos sensibles

Crear el archivo real desde la plantilla:

```bash
cp deploy/aws/aws.env.example deploy/aws/aws.env
chmod 600 deploy/aws/aws.env
```

Completar los placeholders localmente en EC2. `deploy/aws/aws.env` esta ignorado por Git. No copiar el archivo de recuperacion de TiDB ni ningun `.env` de Windows.

La URL efectiva del frontend es `https://www.lodelprofe.com`. El dominio sin `www` redirige permanentemente hacia este. La cookie CSRF usa `Domain=lodelprofe.com`; la cookie JWT continua siendo host-only en `api.lodelprofe.com`.

## Construccion fuera de EC2

Construir la imagen en CI o en otra maquina y publicarla para Linux AMD64, la arquitectura de `t3.micro`, con un tag inmutable en ECR:

```bash
docker buildx build \
  --platform linux/amd64 \
  -f backend/Dockerfile \
  -t "$ECR_IMAGE" \
  --push \
  backend
```

Establecer ese tag completo en `BACKEND_IMAGE`. No ejecutar `npm ci` ni el build TypeScript en la `t3.micro`.

## Validacion previa sin iniciar servicios

```bash
docker compose \
  --env-file deploy/aws/aws.env \
  -f docker-compose.aws.yml \
  --profile app \
  config --quiet
```

`config --quiet` valida la configuracion sin imprimir los secretos interpolados.

## Secuencia de restauracion

1. Iniciar solamente MySQL:

   ```bash
   docker compose --env-file deploy/aws/aws.env -f docker-compose.aws.yml up -d mysql
   ```

   En esta etapa pueden quedar sin definir `BACKEND_IMAGE`, `DATABASE_URL`, `JWT_SECRET` y Web Push. El backend esta detras del profile `app` y este comando no lo inicia.

2. Esperar el estado `healthy` y copiar el dump privado al contenedor:

   ```bash
   docker compose --env-file deploy/aws/aws.env -f docker-compose.aws.yml cp \
     /ruta/privada/lodelprofe-final.sql mysql:/tmp/lodelprofe-final.sql
   ```

3. Restaurar. Este paso se ejecutara unicamente durante la migracion aprobada:

   ```bash
   docker compose --env-file deploy/aws/aws.env -f docker-compose.aws.yml exec -T mysql sh -lc \
     'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot < /tmp/lodelprofe-final.sql'
   ```

4. Validar las 19 tablas y comparar como minimo estos conteos del backup de prueba:

   - `users`: 21
   - `bookings`: 92
   - `league_players`: 32
   - `league_pairs`: 16
   - `league_matches`: 71
   - `cash_movements`: 1

   El backup definitivo puede contener valores superiores si hubo actividad posterior.

5. Despues de validar la restauracion, ejecutar migraciones de manera explicita:

   ```bash
   docker compose --env-file deploy/aws/aws.env -f docker-compose.aws.yml --profile app run --rm backend \
     npx --no-install prisma migrate deploy
   ```

6. Solo entonces iniciar el backend:

   ```bash
   docker compose --env-file deploy/aws/aws.env -f docker-compose.aws.yml --profile app up -d backend
   curl --fail http://127.0.0.1:3000/api/health
   ```

   Antes de habilitar `app`, definir una imagen inmutable real en `BACKEND_IMAGE`, junto con `DATABASE_URL`, `JWT_SECRET` y los valores Web Push requeridos. El nombre de imagen de respaldo es deliberadamente invalido para que una configuracion incompleta falle de forma segura.

No ejecutar seeds ni `prisma db push`.

## Observabilidad durante la prueba

```bash
bash deploy/aws/check-resources.sh
watch -n 5 bash deploy/aws/check-resources.sh
```

El reporte muestra RAM, swap, disco, CPU, memoria por contenedor, cantidad de procesos, reinicios, estado de healthcheck, `OOMKilled` y eventos OOM del kernel.

Comandos adicionales:

```bash
docker compose --env-file deploy/aws/aws.env -f docker-compose.aws.yml --profile app logs --tail 100 mysql backend
docker events --filter event=oom
vmstat 5
```

Si hay swap constante, reinicios OOM o latencias durante generacion de imagenes, no se deben elevar ambos limites hasta consumir toda la RAM: corresponde medir y evaluar una `t3.small`.
