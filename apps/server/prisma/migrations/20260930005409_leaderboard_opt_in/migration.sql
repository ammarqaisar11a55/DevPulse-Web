-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "show_on_leaderboard" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "user_settings_show_on_leaderboard_idx" ON "user_settings"("show_on_leaderboard");
