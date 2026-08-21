# El Gringo Celulares

Sistema de gestión para un servicio técnico de celulares: órdenes de reparación,
clientes, presupuestos, usuarios y reportes. **Datos centralizados** en un backend
Node/Express (la base es un archivo JSON que se comparte entre todos los dispositivos de la red).

## Credenciales de prueba

- **Administrador:** `admin@local.com` / `admin123`

---

## 1) Probar en tu casa (solo Node, sin Docker)

La app corre sin Docker. Esto te permite probar toda la funcionalidad y el acceso
multi-dispositivo antes de instalarla en el trabajo.

```bash
# 1. Instalar dependencias
npm install
cd server && npm install && cd ..

# 2. Compilar el frontend
npm run build

# 3. Levantar el servidor (sirve la app + la API en el puerto 8080)
cd server && npm start
```

Abrí `http://localhost:8080` en tu PC. Para probar **multi-dispositivo** (datos compartidos):

1. Abrí una terminal y obtené tu IP local: `ipconfig` → anotá el **IPv4** (ej. `192.168.1.50`).
2. En el celular, conectado al **mismo Wi-Fi**, entrá a `http://<tu-IP>:8080`.
3. La primera vez, Windows mostrará el aviso del **firewall** → aceptá para la red privada.
4. Entrá con el usuario **admin** desde dos dispositivos y verificá que **ven los
   mismos datos**.

> Si algo no funciona desde el celular, revisá que tu PC y el celular estén en la misma
> red y que el firewall permita el puerto 8080.

### Resetear los datos de prueba

Borrá el archivo `server/data/db.json` y reiniciá el servidor para volver a sembrar
los datos de ejemplo.

---

## 2) Instalar en la PC del trabajo (Docker + nginx)

### Requisitos

- **Docker Desktop** instalado en la PC del trabajo.
  - Requiere **Windows 10 21H2+ / Windows 11** con WSL2 o Hyper-V.
  - Si la PC es Windows 10 **LTSC 2019**, Docker Desktop no funciona: usá
    **WSL2 + Docker Engine** (sin Docker Desktop) o una versión LTSC 2021/2024.
- Habilitar en Docker Desktop: *Settings → General → "Start Docker Desktop when you sign in"*.

### Pasos

1. Copiá la carpeta del proyecto a la PC del trabajo.
2. Abrí una terminal en esa carpeta y ejecutá:

```bash
docker compose up -d --build
```

3. La primera vez tarda unos minutos (compila las imágenes). Después arranca en segundos.
4. Con `restart: unless-stopped`, la app **se levanta sola al encender la PC**.

### Acceder desde todos los dispositivos del local

1. Obtené la IP de la PC del trabajo: `ipconfig` → anotá el **IPv4**.
2. Cada dispositivo del local entra a `http://<IP-de-la-PC>:8081`.
3. Si no se ve desde otros equipos, abrí el **Firewall de Windows** → *Permitir una app
   o característica* → agregá el puerto **8081** (o Docker Desktop) para la red privada.

### Comandos útiles

```bash
docker compose up -d            # iniciar
docker compose down             # detener
docker compose logs -f          # ver registros
docker compose restart          # reiniciar
docker compose down -v          # detener y BORRAR la base de datos (¡cuidado!)
```

Los datos quedan en el volumen `service-center_data` y sobreviven reinicios.

### Cambiar el puerto

Editá `docker-compose.yml`, línea `- "8081:80"`, y cambiá el `8081` por otro puerto.

---

## 3) Desarrollo (modo dev, NO toca producción)

Para probar cambios sin arriesgar los datos reales, el entorno de desarrollo usa:
- **Backend de dev** en el puerto **3001** (base: `server/data/db.json`, archivo local).
- **Frontend de dev** (Vite) en **http://localhost:5173**, que redirige `/api` al 3001.
- La **producción** Docker sigue viviendo en el puerto **8080** con sus datos en el volumen.

Forma más simple: doble clic en **`dev.bat`** (levanta backend dev + frontend dev en dos ventanas).

También a mano:

```bash
# 1. Backend de desarrollo (puerto 3001)
set PORT=3001 && node server/index.js

# 2. Frontend de desarrollo (puerto 5173)
npm run dev
```

Herramientas incluidas:

- `dev.bat` — levanta todo el entorno de dev.
- `reset-dev-datos.bat` — vuelve la base de dev a datos de ejemplo (guarda la anterior como `db.respaldo.json`).
- `deploy.bat` — actualiza código (`git pull`) y reconstruye Docker en producción.
- `backup-datos.bat` — copia los datos reales del volumen a `server/data/db.json` (respaldo fuera de Docker).

> Si querés apuntar el frontend de dev a otro backend: `VITE_API_TARGET=http://localhost:3001 npm run dev`
> (por defecto ya apunta a 3001 en `vite.config.js`).

## Estructura

```
server/        API REST (Express), base JSON compartida, seed
src/           Frontend React (Vite + Tailwind + React Router)
docker-compose.yml / Dockerfile.* / nginx.conf   Despliegue con Docker
*.bat          Herramientas de dev/deploy (dev, deploy, backup, reset)
```