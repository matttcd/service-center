# El Gringo Celulares

Sistema integral de gestión para servicio técnico de celulares y dispositivos electrónicos: órdenes de reparación, clientes, presupuestos, repuestos, catálogo de marcas y modelos, usuarios con roles, métricas y reportes.

**Persistencia centralizada:** Base de datos relacional **PostgreSQL 16** administrada mediante **Prisma ORM**. Los datos se comparten en tiempo real entre todos los dispositivos del local (computadoras de mostrador, tablets y celulares del taller) mediante Server-Sent Events (SSE).

---

## Credenciales iniciales de prueba

- **Administrador:** `admin@local.com` / `admin123`

---

## Arquitectura y Puertos

| Servicio | Entorno Producción (Docker) | Entorno Desarrollo Local |
| :--- | :--- | :--- |
| **Frontend** | `http://<IP-local>:8081` (Nginx) | `http://localhost:5173` (Vite) |
| **Backend API** | Puerto interno `3000` (Express) | `http://localhost:4000` (Express) |
| **Base de Datos** | `localhost:5432` (`service-center-db`) | `localhost:5432` (PostgreSQL local o contenedor) |
| **Print Bridge** | TCP `9200` en Windows Host | TCP `9200` (`python print_bridge.py`) |

---

## 1) Instalación y Despliegue en Producción (Docker)

### Requisitos

- **Docker Desktop** con WSL2 habilitado (Windows 10 21H2+ o Windows 11).
- Archivo `.env` en la raíz configurado (mínimo con `PG_PASSWORD` y `JWT_SECRET`).
- (Opcional) **Python 3** y **SumatraPDF** en la PC donde esté conectada la impresora USB (para el Print Bridge).

### Pasos

1. Cloná o copiá la carpeta del proyecto en la PC principal del local.
2. Verificá que exista el archivo `.env` en la raíz con las variables de producción:
   ```env
   PG_PASSWORD=tu_clave_segura_de_postgres
   JWT_SECRET=tu_secreto_jwt_largo_y_seguro
   PRINT_BRIDGE_HOST=localhost
   ```
3. Ejecutá en una terminal:
   ```bash
   docker compose up -d --build
   ```
   *(También podés hacer doble clic en `docker-start.bat`).*
4. Los contenedores arrancarán con `restart: unless-stopped`, iniciando automáticamente al encender la PC.

### Acceso multi-dispositivo desde la red del local

1. Obtené la IP local de la PC principal: abrí una terminal y ejecutá `ipconfig` → anotá el **IPv4** (ej. `192.168.1.50`).
2. Desde cualquier teléfono, tablet o PC conectada a la misma red Wi-Fi/cableada, accedé a:
   ```
   http://192.168.1.50:8081
   ```
3. Si no conecta desde otros dispositivos, permití el puerto **8081** en el Firewall de Windows para redes privadas.

---

## 2) Entorno de Desarrollo (Local sin Docker)

Para desarrollar o probar cambios de código sin afectar los datos reales de producción:

### Requisitos

- Node.js 20+ instalado en Windows.
- Una instancia de PostgreSQL corriendo (por ejemplo el contenedor `service-center-db` o PostgreSQL local en el puerto 5432).

### Pasos

```bash
# 1. Instalar dependencias raíz y del servidor
npm install
cd server && npm install && cd ..

# 2. Generar el cliente Prisma y migrar la base local
cd server
npx prisma generate
npx prisma db push
cd ..

# 3. Iniciar el entorno completo de desarrollo
# Opción A: Doble clic en dev.bat (abre paneles en Windows Terminal con frontend + backend + print bridge)
# Opción B: En terminales separadas:
npm run dev           # Frontend Vite en http://localhost:5173
npm run dev:server    # Backend Node en http://localhost:4000
```

---

## 3) Servicio de Impresión (Print Bridge)

El **Print Bridge** (`server/printer/print_bridge.py`) es un servidor TCP ligero que corre en Windows (puerto 9200) y permite que el backend (incluso corriendo dentro de Docker) imprima automáticamente en las impresoras locales:

1. **Etiquetas ZPL:** Envío directo RAW a impresoras térmicas Zebra (ej. GT800).
2. **Comprobantes y Constancias PDF:** Impresión silenciosa vía **SumatraPDF**.

Para iniciar el bridge:
- Doble clic en **`start_bridge.bat`**.

---

## 4) Respaldos y Mantenimiento de PostgreSQL

Los datos de producción residen en el volumen Docker `service-center_pgdata`. Se incluyen múltiples mecanismos de copia de seguridad:

### Copias Automáticas
- El backend programa diariamente una copia de seguridad a las 03:00 hs en la carpeta `data/backups`.
- Desde la interfaz web (solo rol Administrador, menú **Respaldos**), podés ver las copias existentes, crear un respaldo manual con un clic o restaurar una copia previa.

### Scripts de Respaldo por Línea de Comandos (Windows)

- **`backup-datos.bat`**: Genera un archivo binario `.dump` con marca de tiempo en la carpeta local `backups/` mediante `pg_dump` ejecutado sobre el contenedor `service-center-db`.
- **`restore-datos.bat`**: Asistente interactivo que lista las copias disponibles en `backups/`, solicita confirmación y restaura la base de datos en PostgreSQL con `pg_restore`.
- **`reset-dev-datos.bat`**: Reinicia la base de datos local de desarrollo (`prisma db push --force-reset`) y recarga el catálogo oficial y usuario administrador inicial.
- **`deploy.bat`**: Realiza `git pull` y reconstruye las imágenes de Docker en producción en el puerto 8081 sin tocar los datos guardados.

---

## 5) Pruebas Automatizadas y Calidad de Código

El proyecto cuenta con una suite de pruebas unitarias implementada con **Vitest** que valida la máquina de estados de las órdenes, la lógica de permisos por rol, la normalización de WhatsApp y las funciones auxiliares de texto y fechas.

```bash
# Ejecutar la suite completa de pruebas
npm test

# Ejecutar las pruebas en modo interactivo (watch)
npm run test:watch

# Ejecutar el linter (Oxlint)
npm run lint
```

---

## Estructura del Proyecto

```
server/
  ├── index.js            # API REST Express, SSE en tiempo real y endpoints
  ├── db.js               # Conexión centralizada con Prisma Client y listeners
  ├── prisma/
  │   └── schema.prisma   # Esquema relacional de PostgreSQL
  ├── seed.js             # Catálogo inicial (marcas, modelos por tipo) y admin
  ├── whatsapp.js         # Integración GreenAPI y formateo de teléfonos
  ├── pdf/                # Plantillas HTML y renderizado PDF con Puppeteer
  └── printer/            # Print Bridge TCP para impresión ZPL y PDF en Windows
shared/
  ├── fsm.js              # Máquina de estados (FSM) de órdenes y permisos por rol
  └── text.js             # Normalización de textos, marcas y siglas
src/
  ├── pages/              # Vistas: Dashboard, Taller, Órdenes, Clientes, Terminados, etc.
  ├── components/         # Componentes UI reutilizables y modales
  ├── context/            # AuthContext y DataContext (conexión SSE y mutaciones)
  └── utils/              # Clientes de API, helpers y almacenamiento de sesión
tests/                    # Suite de pruebas unitarias con Vitest
*.bat                     # Scripts de Windows (dev, deploy, backup, restore, reset)
docker-compose.yml        # Orquestación de PostgreSQL, backend Node y frontend Nginx
```