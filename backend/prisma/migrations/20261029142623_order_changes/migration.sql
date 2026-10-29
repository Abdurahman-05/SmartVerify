-- AlterEnum
ALTER TYPE "BillStatus" ADD VALUE 'cancelled';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" TEXT,
ADD COLUMN     "editedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "BusinessMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
