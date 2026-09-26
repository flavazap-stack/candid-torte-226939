import type { Config, Context } from "@netlify/functions";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../../db/index.js";
import { attendance, employees } from "../../db/schema.js";

const encoder = new TextEncoder();
const papuaDate = (date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jayapura", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const papuaTime = (date?: Date | null) => date ? new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jayapura", hour: "2-digit", minute: "2-digit", hour12: false }).format(date) : "";
const json = (data: unknown, callback?: string) => {
  if (callback && /^[A-Za-z_$][\w$]*$/.test(callback)) return new Response(`${callback}(${JSON.stringify(data)})`, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" } });
  return Response.json(data, { headers: { "cache-control": "no-store" } });
};
const rowEmployee = (e: typeof employees.$inferSelect) => ({ id: String(e.id), nik: e.nik, nama: e.name, divisi: e.division, wa: e.whatsapp, desc: e.faceDescriptor, hasFace: e.faceDescriptor.length > 0 });
const rowLog = (r: { attendance: typeof attendance.$inferSelect; employee: typeof employees.$inferSelect }) => ({ tanggal: r.attendance.date, nik: r.employee.nik, nama: r.employee.name, jamMasuk: papuaTime(r.attendance.clockIn), jamPulang: papuaTime(r.attendance.clockOut), status: r.attendance.status });

async function signature(value: string) {
  const password = Netlify.env.get("ADMIN_PASSWORD") || "";
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)))).map(b => b.toString(16).padStart(2, "0")).join("");
}
async function issueToken() { const expiry = Date.now() + 8 * 60 * 60 * 1000; return `${expiry}.${await signature(String(expiry))}`; }
async function validToken(token: string) { const [expiry, sig] = token.split("."); return Boolean(expiry && sig && Number(expiry) > Date.now() && sig === await signature(expiry)); }

async function dashboardData() {
  const date = papuaDate();
  const people = await db.select().from(employees).where(eq(employees.active, true));
  const logs = await db.select({ attendance, employee: employees }).from(attendance).innerJoin(employees, eq(attendance.employeeId, employees.id)).where(eq(attendance.date, date)).orderBy(desc(attendance.clockIn));
  return { people, logs };
}

export default async (req: Request, _context: Context) => {
  try {
    const url = new URL(req.url);
    let action = url.searchParams.get("action") || "";
    const callback = url.searchParams.get("callback") || undefined;
    let payload: any = Object.fromEntries(url.searchParams);
    if (req.method === "POST") {
      const type = req.headers.get("content-type") || "";
      if (type.includes("application/json")) payload = await req.json();
      else {
        const form = await req.formData();
        action = String(form.get("action") || action);
        payload = JSON.parse(String(form.get("payload") || "{}"));
      }
      action ||= String(payload.action || "");
    }
    const token = String(payload.token || url.searchParams.get("token") || "");

    if (action === "employee") {
      const [employee] = await db.select().from(employees).where(and(eq(employees.nik, String(payload.nik || "")), eq(employees.active, true))).limit(1);
      if (!employee) return json({ success: false, message: "NIK tidak ditemukan atau belum aktif." }, callback);
      const [log] = await db.select().from(attendance).where(and(eq(attendance.employeeId, employee.id), eq(attendance.date, papuaDate()))).limit(1);
      return json({ success: true, data: rowEmployee(employee), status: !log ? "belum_masuk" : log.clockOut ? "selesai" : "sudah_masuk" }, callback);
    }
    if (action === "selfRegister") {
      const nik = String(payload.nik || "").trim(), name = String(payload.nama || "").trim();
      if (!nik || !name || !Array.isArray(payload.desc)) return json({ success: false, message: "Data registrasi belum lengkap." }, callback);
      await db.insert(employees).values({ nik, name, faceDescriptor: payload.desc }).onConflictDoUpdate({ target: employees.nik, set: { name, faceDescriptor: payload.desc, active: true } });
      return json({ success: true }, callback);
    }
    if (action === "attendance" && req.method === "POST") {
      const id = Number(payload.id), now = new Date(), date = papuaDate(now);
      const [employee] = await db.select().from(employees).where(and(eq(employees.id, id), eq(employees.active, true))).limit(1);
      if (!employee) return json({ success: false, message: "Personel tidak ditemukan." }, callback);
      const [existing] = await db.select().from(attendance).where(and(eq(attendance.employeeId, id), eq(attendance.date, date))).limit(1);
      if (!existing) await db.insert(attendance).values({ employeeId: id, date, clockIn: now, latitude: String(payload.lat || ""), longitude: String(payload.lng || ""), address: String(payload.alamat || ""), status: Number(papuaTime(now).replace(".", ":").slice(0, 2)) >= 8 ? "Terlambat" : "Hadir" });
      else if (!existing.clockOut) await db.update(attendance).set({ clockOut: now, latitude: String(payload.lat || existing.latitude), longitude: String(payload.lng || existing.longitude), address: String(payload.alamat || existing.address) }).where(eq(attendance.id, existing.id));
      return json({ success: true }, callback);
    }

    if (action === "adminLogin") {
      const configured = Netlify.env.get("ADMIN_PASSWORD");
      if (!configured) return json({ success: false, message: "ADMIN_PASSWORD belum dikonfigurasi di Netlify." }, callback);
      if (payload.username !== "admin" || payload.password !== configured) return json({ success: false, message: "Username atau kata sandi salah." }, callback);
      return json({ success: true, token: await issueToken() }, callback);
    }
    if (action.startsWith("admin") && !(await validToken(token))) return json({ success: false, auth: false, message: "Sesi admin berakhir." }, callback);
    if (action === "adminCheck") return json({ success: true }, callback);
    if (action === "adminDashboard") {
      const { people, logs } = await dashboardData();
      return json({ success: true, stats: { personel: people.length, hadir: logs.length, terlambat: logs.filter(x => x.attendance.status === "Terlambat").length, belum: Math.max(0, people.length - logs.length) }, recent: logs.slice(0, 12).map(rowLog), generatedAt: new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jayapura", dateStyle: "medium", timeStyle: "short" }).format(new Date()) }, callback);
    }
    if (action === "adminEmployees") return json({ success: true, employees: (await db.select().from(employees).where(eq(employees.active, true)).orderBy(asc(employees.name))).map(rowEmployee) }, callback);
    if (action === "adminSaveEmployee") {
      const values = { nik: String(payload.nik || "").trim(), name: String(payload.nama || "").trim(), division: String(payload.divisi || "Guru").trim(), whatsapp: String(payload.wa || "").trim(), active: true };
      if (!values.nik || !values.name) return json({ success: false, message: "NIK dan nama wajib diisi." }, callback);
      if (payload.id) await db.update(employees).set(values).where(eq(employees.id, Number(payload.id))); else await db.insert(employees).values(values);
      return json({ success: true }, callback);
    }
    if (action === "adminDeleteEmployee") { await db.update(employees).set({ active: false }).where(eq(employees.id, Number(payload.id))); return json({ success: true }, callback); }
    if (action === "adminAttendance") {
      const filters = [gte(attendance.date, String(payload.from || papuaDate())), lte(attendance.date, String(payload.to || papuaDate()))];
      const rows = await db.select({ attendance, employee: employees }).from(attendance).innerJoin(employees, eq(attendance.employeeId, employees.id)).where(and(...filters)).orderBy(desc(attendance.date), desc(attendance.clockIn));
      return json({ success: true, rows: rows.map(rowLog) }, callback);
    }
    if (action === "adminWhatsApp" || action === "wa") {
      const { people, logs } = await dashboardData();
      const late = logs.filter(x => x.attendance.status === "Terlambat").length;
      return json({ success: true, message: `Laporan Absensi SMA Negeri 3 Sarmi\n${papuaDate()}\n\nHadir: ${logs.length}\nTerlambat: ${late}\nBelum absen: ${Math.max(0, people.length - logs.length)}` }, callback);
    }
    if (action === "stats") { const { people, logs } = await dashboardData(); return json({ success: true, stats: { totalHadir: logs.length, totalTerlambat: logs.filter(x => x.attendance.status === "Terlambat").length, personel: people.length } }, callback); }
    if (action === "employees") return json({ success: true, employees: (await db.select().from(employees).where(eq(employees.active, true))).map(rowEmployee) }, callback);
    if (action === "attendance_list" || action === "attendance") {
      const rows = await db.select({ attendance, employee: employees }).from(attendance).innerJoin(employees, eq(attendance.employeeId, employees.id)).orderBy(desc(attendance.date), desc(attendance.clockIn)).limit(30);
      return json({ success: true, attendance: rows.map(rowLog) }, callback);
    }
    if (action === "settings") return json({ success: true }, callback);
    return json({ success: false, message: "Aksi tidak dikenali." }, callback);
  } catch (error) {
    console.error("Attendance API error", error);
    return json({ success: false, message: "Terjadi kesalahan pada server." }, new URL(req.url).searchParams.get("callback") || undefined);
  }
};

export const config: Config = { path: "/api/attendance" };
