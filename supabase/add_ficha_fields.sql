-- Agrega campos que usa la plantilla oficial GDJ-GPO-FMT-005
ALTER TABLE fichas_conciliacion
  ADD COLUMN IF NOT EXISTS fecha_diligencia            DATE   NULL,
  ADD COLUMN IF NOT EXISTS caducidad                   TEXT   NULL,   -- "SI" / "NO" / "NO APLICA"
  ADD COLUMN IF NOT EXISTS expediente_pensional_aplica TEXT   NULL;   -- "SI" / "NO" / "NO APLICA"
