<#
.SYNOPSIS
  Delegación de revisión SOLO-TEXTO a Codex CLI (público), por stdin, sin herramientas.

.DESCRIPTION
  En Windows el sandbox read-only de Codex bloquea sus subprocesos (rg/Get-ChildItem →
  "blocked by policy"), así que no puede inspeccionar el filesystem. Este helper esquiva ese
  límite: envía por STDIN únicamente el fragmento/diff + contexto y le indica a Codex que
  revise SOLO ese texto, sin usar herramientas ni tocar el sistema de archivos.

  - Usa el CLI público (por defecto %APPDATA%\npm\codex.cmd), no el interno de .sandbox-bin.
  - CODEX_HOME aislado (por defecto %USERPROFILE%\.codex-cli), solo para este proceso; se
    restaura el estado global (env vars, ErrorActionPreference) al terminar, aun si falla.
  - stdin se envía como archivo temporal UTF-8 (sin BOM) → conserva tildes y caracteres.
  - Workdir neutro (carpeta temporal) → Codex no tiene proyecto que explorar.
  - Guardia anti-secretos PREVENTIVA (best-effort): NO garantiza detectar todo dato sensible.
  - Diferencia el exit code y el stderr REAL (transcript de codex vs. marcadores de error).
  - Una sola revisión por invocación. No encadena agentes.

  La respuesta de Codex es material a VERIFICAR contra el código antes de proponer cambios;
  el helper NO aplica correcciones.

.PARAMETER InputFile
  Ruta a un archivo de texto (UTF-8) con el fragmento/diff + contexto (sin credenciales ni datos
  personales). El autor es responsable de excluir secretos.

.PARAMETER Cli
  Ruta al codex.cmd público. Por defecto "$env:APPDATA\npm\codex.cmd".

.PARAMETER CodexHome
  CODEX_HOME aislado. Por defecto "$env:USERPROFILE\.codex-cli".

.EXAMPLE
  .\scripts\codex-review.ps1 -InputFile .\revision.txt
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$InputFile,
  [string]$Cli = "$env:APPDATA\npm\codex.cmd",
  [string]$CodexHome = "$env:USERPROFILE\.codex-cli"
)

$origEap = $ErrorActionPreference   # valor heredado del llamador (se restaura al final)
$ErrorActionPreference = "Stop"

if (-not (Test-Path $InputFile)) { throw "No existe el archivo de entrada: $InputFile" }
if (-not (Test-Path $Cli)) {
  throw "No se encontró el CLI público en '$Cli'. Instálalo con: npm install -g @openai/codex"
}

# Lectura en UTF-8 → conserva tildes y caracteres del código enviado.
$contenido = Get-Content -Raw -Encoding UTF8 $InputFile
if ([string]::IsNullOrWhiteSpace($contenido)) { throw "El archivo de entrada está vacío." }

# --- Guardia anti-secretos (PREVENTIVA / best-effort) ---
# Apunta a VALORES que parecen credenciales (literales entre comillas o prefijos de clave reales),
# no a referencias de código como `process.env.CRON_SECRET`. NO garantiza detectar todo secreto.
$patronesSecreto = @(
  '-----BEGIN [A-Z ]*PRIVATE KEY-----',
  'eyJ[A-Za-z0-9_\-]{18,}\.[A-Za-z0-9_\-]{10,}',                                   # JWT (Supabase anon/service key)
  '\bsk-(?:ant-|proj-)?[A-Za-z0-9\-]{20,}',                                        # OpenAI/Anthropic API key
  '\bghp_[A-Za-z0-9]{30,}',                                                        # GitHub token
  '(?i)\bBearer\s+[A-Za-z0-9._\-]{20,}',
  '(?i)\b(?:api[_-]?key|secret|password|token|service_role)\b\s*[:=]\s*[''"][A-Za-z0-9._\-/+]{16,}[''"]'  # literal entre comillas
)
foreach ($p in $patronesSecreto) {
  if ($contenido -match $p) {
    throw "ABORTADO: el texto parece contener un secreto (patrón: $p). Quita credenciales antes de delegar."
  }
}

# --- Estado global a restaurar (env var del proceso) ---
$origCodexHome = $env:CODEX_HOME

$workdir   = Join-Path $env:TEMP ("codex-review-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
$stdinFile = [System.IO.Path]::GetTempFileName()
$outFile   = [System.IO.Path]::GetTempFileName()
$errFile   = [System.IO.Path]::GetTempFileName()
$fallo = $false

# Marcadores de error REAL de codex en stderr (el transcript normal tambien se escribe a stderr;
# por eso los patrones son especificos del runtime, no un 'ERROR' generico del codigo revisado).
$patronErrorStderr = "ERROR codex_|thread 'main' panicked|panicked at|blocked by policy|rejected: blocked|failed to spawn"

try {
  $env:CODEX_HOME = $CodexHome
  New-Item -ItemType Directory -Path $workdir -Force | Out-Null
  # stdin como archivo UTF-8 (sin BOM) redirigido → evita el mangling del pipe de PowerShell.
  [System.IO.File]::WriteAllText($stdinFile, $contenido, (New-Object System.Text.UTF8Encoding $false))

  $instruccion = "Revisa unicamente el texto recibido. No utilices herramientas, no ejecutes comandos ni intentes acceder al sistema de archivos. Identifica posibles errores con evidencia del fragmento; si falta contexto, indicalo. No afirmes haber ejecutado pruebas."
  # -ArgumentList como UN string con workdir e instruccion entre comillas (Start-Process no
  # cita los elementos de un arreglo → una instruccion con espacios se partiria en varios args).
  $argString = 'exec -s read-only -C "{0}" --skip-git-repo-check --color never "{1}"' -f $workdir, $instruccion

  Write-Host "-- Codex review (solo-texto, CODEX_HOME=$CodexHome) --"
  $proc = Start-Process -FilePath $Cli -ArgumentList $argString `
    -RedirectStandardInput $stdinFile -RedirectStandardOutput $outFile -RedirectStandardError $errFile `
    -NoNewWindow -Wait -PassThru
  $exit = $proc.ExitCode

  # stdout = mensaje final (limpio); stderr = transcript + posibles errores.
  $salida = Get-Content -Raw -Encoding UTF8 -ErrorAction SilentlyContinue $outFile
  if ($salida) { Write-Output $salida.TrimEnd() }

  $stderr = Get-Content -Raw -Encoding UTF8 -ErrorAction SilentlyContinue $errFile
  $hayError = ($null -ne $stderr) -and ($stderr -match $patronErrorStderr)

  if ($exit -ne 0 -or $hayError -or [string]::IsNullOrWhiteSpace($salida)) {
    $fallo = $true
    Write-Warning "Codex no completó una revisión válida (exit=$exit)."
    if ($hayError) {
      Write-Host "stderr con posibles errores:" -ForegroundColor Yellow
      ($stderr -split "`r?`n" | Where-Object { $_ -match $patronErrorStderr }) | ForEach-Object { Write-Host "  $_" }
    }
  }
}
finally {
  Remove-Item -Recurse -Force $workdir -ErrorAction SilentlyContinue
  Remove-Item -Force $stdinFile, $outFile, $errFile -ErrorAction SilentlyContinue
  # Restaurar estado global (aun si falló).
  if ($null -eq $origCodexHome) { Remove-Item Env:\CODEX_HOME -ErrorAction SilentlyContinue }
  else { $env:CODEX_HOME = $origCodexHome }
  $ErrorActionPreference = $origEap
}

if ($fallo) { exit 1 }
