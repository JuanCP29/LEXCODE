# Instrucciones del proyecto — LEXCODE / FoQs

App Next.js 14 (App Router) + Supabase para generar fichas de conciliación y contestaciones de
Colpensiones con IA (Collegia Abogados).

## Revisiones de código con Codex (solo-texto)
Para una segunda opinión sobre un diff o fragmento, se puede delegar a **Codex CLI** en modo
**solo-texto por stdin** (el sandbox de Codex en Windows bloquea la inspección de archivos).

- Helper: [`scripts/codex-review.ps1`](scripts/codex-review.ps1) — `.\scripts\codex-review.ps1 -InputFile <archivo.txt>`
- Guía completa: [`docs/codex-review.md`](docs/codex-review.md)
- Reglas: CLI público + `CODEX_HOME` aislado (`%USERPROFILE%\.codex-cli`); enviar por stdin solo
  el fragmento + contexto, **sin credenciales ni datos personales**; Codex revisa solo ese texto,
  **sin herramientas**; **una revisión por tarea**, sin llamadas recursivas entre agentes.
- La respuesta de Codex se **verifica contra el código real** y se clasifica en *confirmados /
  posibles riesgos / dudas por falta de contexto* antes de proponer correcciones. El helper no
  aplica cambios.
