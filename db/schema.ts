import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  nik: text("nik").notNull().unique(),
  name: text("name").notNull(),
  division: text("division").notNull().default("Guru"),
  whatsapp: text("whatsapp").notNull().default(""),
  faceDescriptor: jsonb("face_descriptor").$type<number[]>().notNull().default([]),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const attendance = pgTable("attendance", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  date: text("date").notNull(),
  clockIn: timestamp("clock_in", { withTimezone: true }),
  clockOut: timestamp("clock_out", { withTimezone: true }),
  latitude: text("latitude").notNull().default(""),
  longitude: text("longitude").notNull().default(""),
  address: text("address").notNull().default(""),
  status: text("status").notNull().default("Hadir"),
});
