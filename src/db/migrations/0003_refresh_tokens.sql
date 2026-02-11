CREATE TABLE "refresh_tokens" (
  "token" varchar(64) PRIMARY KEY NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "expires_at" timestamp NOT NULL,
  "revoked_at" timestamp
);
