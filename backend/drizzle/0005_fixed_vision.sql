ALTER TABLE "users" ALTER COLUMN "avatar_url" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "refresh_token" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "explanation" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bio" text;