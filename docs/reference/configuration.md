# Configuración del sistema

> Variables de entorno y constantes del sistema definidas en `Code.gs` y `js/config.js`.

---

## Backend (`Code.gs`)

### Constantes de Google Drive

| Constante | Descripción | Cómo obtenerla |
|---|---|---|
| `DRIVE_FOLDER_ID` | Carpeta donde se almacenan los PDFs de trabajos | Abrir carpeta en Drive → URL: `https://drive.google.com/drive/folders/{ID}` |
| `TEMPLATE_ID` | ID de la plantilla de Google Slides para certificados | Abrir Slides → URL: `https://docs.google.com/presentation/d/{ID}/edit` |
| `CERTIFICATES_FOLDER_ID` | Carpeta donde se guardan los certificados generados | Igual que `DRIVE_FOLDER_ID` |

### Constantes del sistema

| Constante | Valor por defecto | Descripción |
|---|---|---|
| `FRONTEND_URL` | `https://congresolabiq.github.io/Sistema` | URL base del frontend (para enlaces en correos) |
| `RESET_TOKEN_EXPIRY_HOURS` | `1` | Horas de validez del token de recuperación |

### Google Sheets

La hoja de cálculo activa se obtiene con `SpreadsheetApp.getActiveSpreadsheet()`. Debe contener las siguientes hojas:

| Hoja | Obligatoria | Descripción |
|---|---|---|
| `users` | ✅ | Registro de usuarios |
| `works` | ✅ | Registro de trabajos |
| `assignments` | ✅ | Asignaciones Fase 1 |
| `evaluations` | ✅ | Evaluaciones Fase 1 |
| `live_assignments` | ✅ | Asignaciones Fase 2 |
| `live_evaluations` | ✅ | Evaluaciones Fase 2 |
| `catalog_professors` | ✅ | Catálogo de profesores |
| `config` | ✅ | Configuración (event_date, evaluator_code) |
| `reset_tokens` | ❌ (se crea sola) | Tokens de recuperación |

### Hoja de configuración (`config`)

| Clave | Valor ejemplo | Descripción |
|---|---|---|
| `event_date` | `15-17 de julio de 2026` | Fecha del congreso (se muestra en agendas) |
| `evaluator_code` | `LABIQ2026` | Código secreto para registro de evaluadores |
| `submission_deadline` | `2026-07-10T18:00:00.000Z` | Fecha límite (ISO 8601) para la subida de trabajos en Fase 1; vacío = sin límite. Bloquea `submitWork` en el backend una vez vencida |

---

## Frontend (`js/config.js`)

```javascript
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec';
```

| Variable | Descripción |
|---|---|
| `GOOGLE_SCRIPT_URL` | URL del despliegue de Google Apps Script |

---

## Service Worker (`service-worker.js`)

| Constante | Valor | Descripción |
|---|---|---|
| `CACHE_NAME` | `labiq-v2` | Nombre del caché (cambiar para forzar actualización) |
| `ASSETS` | Array de rutas | Archivos precacheados al instalar el SW |

### Versiones

Para forzar la actualización del Service Worker en todos los clientes:

1. Incrementa el número de versión en `CACHE_NAME` (ej: `labiq-v3`)
2. Los cambios en `ASSETS` se actualizarán automáticamente

---

## PWA Manifest (`manifest.json`)

| Propiedad | Valor | Descripción |
|---|---|---|
| `name` | `Congreso LABIQ - Sistema de Evaluación` | Nombre completo de la app |
| `short_name` | `LABIQ` | Nombre corto (icono) |
| `start_url` | `index.html` | Página de inicio |
| `display` | `standalone` | Modo sin navegador |
| `background_color` | `#0d6efd` → `#002147` (rediseño) | Color de fondo splash |
| `theme_color` | `#0d6efd` → `#002147` (rediseño) | Color de la barra |
