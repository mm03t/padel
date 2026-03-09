-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PAGADO', 'PENDIENTE', 'VENCIDO');

-- AlterTable
ALTER TABLE "alumnos" ADD COLUMN     "tarifa_mensual" DOUBLE PRECISION DEFAULT 50;

-- CreateTable
CREATE TABLE "pagos" (
    "id" TEXT NOT NULL,
    "alumno_id" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "año" INTEGER NOT NULL,
    "importe" DOUBLE PRECISION NOT NULL,
    "estado" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pagos_alumno_id_mes_año_key" ON "pagos"("alumno_id", "mes", "año");

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_alumno_id_fkey" FOREIGN KEY ("alumno_id") REFERENCES "alumnos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
