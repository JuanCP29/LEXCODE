# Delegación de revisiones a Codex (solo-texto)

Flujo formalizado para pedirle a **Codex CLI** una segunda opinión sobre un diff o fragmento,
como complemento a la revisión propia. Nace de una limitación real: en Windows, el sandbox
`read-only` de Codex **bloquea sus propios subprocesos** (`rg`/`Get-ChildItem` → `blocked by
policy`), por lo que **no puede inspeccionar el filesystem**. La vía que sí funciona es enviarle
el texto por **stdin** y decirle que revise **solo eso, sin herramientas**.

## Requisitos (una vez)
- **CLI público** instalado: `npm install -g @openai/codex` → queda en `%APPDATA%\npm\codex.cmd`.
  No se usa el ejecutable interno de `~/.codex/.sandbox-bin` (roto: le falta `code-mode-host`).
- **CODEX_HOME aislado**: `%USERPROFILE%\.codex-cli`, con login propio (una vez):
  ```powershell
  $env:CODEX_HOME="$env:USERPROFILE\.codex-cli"; & "$env:APPDATA\npm\codex.cmd" login
  ```
  (Sign in with ChatGPT. No copiar credenciales de otra instalación.)

## Uso
1. Escribe el fragmento/diff **+ contexto** en un archivo de texto, **sin credenciales, `.env`
   ni datos personales**. Incluye ruta del archivo y el contexto mínimo para entenderlo.
2. Corre el helper:
   ```powershell
   .\scripts\codex-review.ps1 -InputFile .\revision.txt
   ```
3. El helper: valida la entrada, aplica una **guardia anti-secretos**, aísla `CODEX_HOME`, usa un
   **workdir neutro** y envía el texto por **stdin** con la instrucción fija *"revisa solo el
   texto, no uses herramientas…"*. Devuelve la respuesta de Codex.

## Qué hacer con la respuesta (responsabilidad de quien delega)
- **Conservar** la respuesta cruda de Codex.
- **Clasificar** los hallazgos en: **Confirmados** · **Posibles riesgos** · **Dudas por falta de
  contexto**.
- **Verificar cada hallazgo contra el código real** antes de proponer una corrección. Codex solo
  vio el fragmento; puede señalar cosas que el resto del código ya maneja.
- El helper **no corrige nada**. Las correcciones son un paso aparte, revisado.

## Políticas
- **Una revisión por tarea.** Nada de encadenar llamadas recursivas entre agentes.
- Solo-texto por stdin; **sin acceso a filesystem ni herramientas** desde Codex.
- CLI público + `CODEX_HOME` aislado; no se toca la app de escritorio ni sus carpetas internas.
- **No enviar secretos ni datos personales.** La guardia anti-secretos del helper es
  **preventiva (best-effort): NO garantiza detectar todos los datos sensibles** (solo cubre
  patrones comunes: claves privadas, JWT, `sk-`/`ghp_`, `Bearer …`, literales entre comillas).
  Excluir credenciales y datos personales es **responsabilidad de quien delega**, no del script.
