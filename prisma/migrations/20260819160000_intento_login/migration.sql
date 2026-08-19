-- CreateTable
CREATE TABLE "IntentoLogin" (
    "id" TEXT NOT NULL,
    "identificador" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntentoLogin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntentoLogin_identificador_ip_createdAt_idx" ON "IntentoLogin"("identificador", "ip", "createdAt");
