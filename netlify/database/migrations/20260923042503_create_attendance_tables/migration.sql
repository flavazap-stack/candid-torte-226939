CREATE TABLE "attendance" (
	"id" serial PRIMARY KEY,
	"employee_id" integer NOT NULL,
	"date" text NOT NULL,
	"clock_in" timestamp with time zone,
	"clock_out" timestamp with time zone,
	"latitude" text DEFAULT '' NOT NULL,
	"longitude" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'Hadir' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY,
	"nik" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"division" text DEFAULT 'Guru' NOT NULL,
	"whatsapp" text DEFAULT '' NOT NULL,
	"face_descriptor" jsonb DEFAULT '[]' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id");