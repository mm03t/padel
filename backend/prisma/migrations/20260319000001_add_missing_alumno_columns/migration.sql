-- AlterTable: add missing columns to alumnos
ALTER TABLE "alumnos" ADD COLUMN IF NOT EXISTS "pago_al_dia" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "alumnos" ADD COLUMN IF NOT EXISTS "metodo_pago" TEXT;
ALTER TABLE "alumnos" ADD COLUMN IF NOT EXISTS "fecha_pago" TIMESTAMP(3);

-- AlterEnum: add PLAZA_DISPONIBLE to TipoNotificacion if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PLAZA_DISPONIBLE' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'TipoNotificacion')) THEN
    ALTER TYPE "TipoNotificacion" ADD VALUE 'PLAZA_DISPONIBLE';
  END IF;
END $$;
