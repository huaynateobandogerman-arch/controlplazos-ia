# CONTROLPLAZOS IA

Aplicación React con Vite y JavaScript para el Checkpoint 5.

## Desarrollo

```sh
pnpm install
pnpm run dev
```

Abrir http://127.0.0.1:5173.

## Compilación

```sh
pnpm run build
```

Permite seleccionar o arrastrar un CSV UTF-8 para completar la tabla y calcular indicadores localmente. Solo al enviar una pregunta, los registros y la pregunta se envían a Ollama Cloud mediante el backend.

Columnas requeridas (sin columnas adicionales): `caso,unidad,responsable,fecha_vencimiento,estado,observacion`. Fechas aceptadas: `AAAA-MM-DD` y `DD/MM/AAAA`. Las fechas inválidas, los archivos vacíos y los errores de estructura impiden cargar el archivo y dejan la tabla vacía.

Los ejecutados se identifican ignorando mayúsculas y espacios externos. Vencidos: no ejecutados con fecha anterior a hoy. Próximos: no ejecutados desde hoy hasta hoy + 3 días calendario, inclusive. Las comparaciones usan la fecha local del navegador sin hora.

La lógica CSV está en `src/csv.js`, el chat en `src/Assistant.jsx` y sus backends en `api/chat.js` y `api/casos.js`. No hay autenticación.

## Persistencia Supabase (preparada, pendiente de configurar)

`supabase/schema.sql` contiene la tabla, la restricción única sobre `caso` y la protección RLS sin acceso público. El SQL no se ejecuta automáticamente y todavía no se ha ejecutado en el proyecto remoto.

Configura únicamente en `.env` local `SUPABASE_URL` (Project URL del proyecto) y `SUPABASE_SERVICE_ROLE_KEY` (clave `service_role` de Settings → API Keys → Legacy API Keys). Conserva `OLLAMA_API_KEY`. No uses prefijos `VITE_` ni compartas el archivo. Reinicia con Ctrl+C y `pnpm.cmd run dev` después de editarlo.

El backend usa la API REST de Supabase con fetch nativo, sin dependencias adicionales. GET `/api/casos` recupera todos los casos con paginación. POST valida y guarda en una sola operación mediante upsert por `caso`; actualiza casos existentes y conserva los que no estén en el CSV. Para repetidos en el mismo archivo, prevalece la última fila. Las fechas se guardan como DATE y `created_at` se conserva al actualizar.

Al abrir la aplicación se recuperan los registros. Tras guardar un CSV, tabla, indicadores y asistente usan el conjunto completo almacenado. Si falla el guardado, el CSV sigue disponible en memoria y se muestra un aviso explícito; no hay reintentos automáticos. Sin credenciales o tabla creada no habrá persistencia. El servidor local permanece vinculado a 127.0.0.1; el backend no tiene autenticación y no se publica en esta etapa.

Pruebas: `pnpm test`. Incluyen CSV y backend con respuestas simuladas, sin llamadas de pago.

## Configurar Ollama Cloud localmente

1. Edita `.env` en la raíz y reemplaza únicamente `PEGA_AQUI_TU_CLAVE` por tu clave. No compartas ese archivo ni uses variables con prefijo `VITE_`.
2. Detén el proceso de desarrollo con Ctrl+C y ejecuta `pnpm run dev` (en PowerShell, `pnpm.cmd run dev` también funciona).
3. Abre http://127.0.0.1:5173, carga un CSV y envía una pregunta.

Se requiere Node 22 o posterior. Un solo comando inicia Vite en 5173 y el backend en 3001, ambos vinculados a 127.0.0.1. No necesitas instalar Ollama localmente. La clave se carga solo en el proceso Node y nunca se incluye en el contexto del modelo. `.env` y sus variantes están ignorados; `.env.example` solo contiene un marcador. El historial es visual y se limpia al cambiar de CSV; cada pregunta envía los registros actuales. El chat admite preguntas de hasta 2000 caracteres y solicitudes de hasta 200 KB, sin truncar registros silenciosamente.

Se usa el modelo solicitado `gpt-oss:120b-cloud`, cuyo identificador para la API directa https://ollama.com/api/chat es `gpt-oss:120b`, según https://docs.ollama.com/cloud. El prompt restringe las respuestas al CSV y establece las reglas de fechas; las respuestas generadas pueden necesitar comprobación contra la tabla.

`api/chat.js` exporta un handler Node compatible con Vercel Functions; no se ha desplegado ni conectado Vercel. En una etapa posterior, configurar `OLLAMA_API_KEY` como variable de entorno del servidor en Vercel. El script `server/dev.js` es únicamente para desarrollo. `pnpm run preview` solo previsualiza la compilación estática y no inicia el backend.
