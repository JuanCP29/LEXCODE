-- Tabla principal de casos pendientes
CREATE TABLE IF NOT EXISTS pendientes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id       UUID NOT NULL REFERENCES casos(id) ON DELETE CASCADE,
  motivo        TEXT NOT NULL,           -- 'sin_traslado_demanda' | etc.
  descripcion   TEXT,
  estado        TEXT NOT NULL DEFAULT 'pendiente',  -- 'pendiente' | 'resuelto'
  creado_por    UUID NOT NULL REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resuelto_at   TIMESTAMPTZ,
  resuelto_por  UUID REFERENCES auth.users(id)
);

-- Historial de acciones ejecutadas sobre cada pendiente
CREATE TABLE IF NOT EXISTS acciones_pendiente (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pendiente_id  UUID NOT NULL REFERENCES pendientes(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL,  -- 'memorial_generado' | 'enviado_portal' | 'enviado_correo' | 'nota'
  descripcion   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_por    UUID NOT NULL REFERENCES auth.users(id)
);

-- RLS
ALTER TABLE pendientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE acciones_pendiente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios ven sus pendientes"
  ON pendientes FOR SELECT
  USING (auth.uid() = creado_por);

CREATE POLICY "usuarios crean pendientes"
  ON pendientes FOR INSERT
  WITH CHECK (auth.uid() = creado_por);

CREATE POLICY "usuarios actualizan sus pendientes"
  ON pendientes FOR UPDATE
  USING (auth.uid() = creado_por);

CREATE POLICY "usuarios ven acciones de sus pendientes"
  ON acciones_pendiente FOR SELECT
  USING (auth.uid() = creado_por);

CREATE POLICY "usuarios insertan acciones"
  ON acciones_pendiente FOR INSERT
  WITH CHECK (auth.uid() = creado_por);
