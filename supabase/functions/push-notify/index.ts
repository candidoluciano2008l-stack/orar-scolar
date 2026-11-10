import { createClient } from "jsr:@supabase/supabase-js@2";
import { ApplicationServer, importVapidKeys, Urgency } from "jsr:@negrel/webpush";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-push-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Server configuration error" }, 500);

  const suppliedSecret = req.headers.get("x-push-secret") ?? "";
  const { data: config, error: configError } = await adminClient.rpc("get_push_config");
  if (configError || !config?.internal_token) return json({ error: "Push configuration error" }, 500);
  if (suppliedSecret !== config.internal_token) return json({ error: "Unauthorized" }, 401);

  let payload: { event_type?: string; record?: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const type = payload.event_type;
  const record = payload.record ?? {};
  if (!["comment","announcement","task","schedule_change","poll","subject_material"].includes(type)) return json({ error: "Unknown event" }, 400);

  const { data: subscriptions, error: subError } = await adminClient
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth");

  if (subError) return json({ error: subError.message }, 500);
  if (!subscriptions?.length) return json({ ok: true, delivered: 0 });

  const privateJwk = JSON.parse(String(config.vapid_private_jwk));
  const publicJwk = {
    kty: privateJwk.kty,
    x: privateJwk.x,
    y: privateJwk.y,
    crv: privateJwk.crv,
  };
  const vapidKeys = await importVapidKeys({ publicKey: publicJwk, privateKey: privateJwk });
  const appServer = await ApplicationServer.new({
    contactInformation: "mailto:candidoluciano2008l@gmail.com",
    vapidKeys,
  });

  let title = "Orarul meu";
  let rawBody = "";
  let url = "https://orar-scolar.vercel.app/";

  if (type === "comment") {
    title = "Comentariu nou";
    rawBody = `${String(record.name ?? "Cineva")} la ${String(record.subject ?? "o materie")}: ${String(record.message ?? "")}`;
    url = "https://orar-scolar.vercel.app/#scheduleSection";
  } else if (type === "announcement") {
    title = `Anunț nou: ${String(record.title ?? "Anunț")}`;
    rawBody = String(record.message ?? "");
    url = "https://orar-scolar.vercel.app/#announcementsSection";
  } else if (type === "task") {
    title = `${String(record.type ?? "Temă")} nouă: ${String(record.subject ?? "Materia")}`;
    rawBody = `${String(record.title ?? "Ai primit o temă")} · Termen: ${String(record.deadline ?? "fără termen")}${record.description ? " · " + String(record.description) : ""}`;
    url = "https://orar-scolar.vercel.app/#tasksSection";
  } else if (type === "schedule_change") {
    title = "Schimbare de program";
    const from = [record.from_date, record.from_start_time, record.from_end_time, record.from_subject].filter(Boolean).join(" ");
    const to = [record.to_date, record.to_start_time, record.to_end_time, record.to_subject].filter(Boolean).join(" ");
    rawBody = `${String(record.note ?? "O oră a fost modificată.")}${from ? " · " + from : ""}${to ? " → " + to : ""}`;
    url = "https://orar-scolar.vercel.app/#changesSection";
  } else if (type === "poll") {
    title = "Poll nou";
    rawBody = String(record.question ?? "A fost publicat un poll nou.");
    url = "https://orar-scolar.vercel.app/#pollsSection";
  } else if (type === "subject_material") {
    const subject = String(record.subject ?? "o materie");
    const subtitle = String(record.subtitle ?? "Material nou");
    const description = String(record.body ?? "").trim();
    const photos = Array.isArray(record.image_paths) ? record.image_paths.length : 0;
    const documents = Array.isArray(record.documents) ? record.documents.length : 0;
    const attachments = [photos ? photos + (photos === 1 ? " fotografie" : " fotografii") : "", documents ? documents + (documents === 1 ? " document" : " documente") : ""].filter(Boolean).join(" · ");
    title = "Material nou la " + subject;
    rawBody = subtitle + (description ? " · " + description : "") + (attachments ? " · " + attachments : "");
    url = "https://orar-scolar.vercel.app/#materials";
  }

  const body = rawBody.length > 180 ? rawBody.slice(0, 177) + "…" : rawBody;
  const notification = JSON.stringify({
    title,
    body,
    data: { url },
    tag: `orar-${type}-${String(record.id ?? Date.now())}`,
  });

  let delivered = 0;
  const stale: string[] = [];

  for (const row of subscriptions) {
    try {
      const subscriber = appServer.subscribe({
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      });
      await subscriber.pushTextMessage(notification, {
        urgency: Urgency.High,
        ttl: 86400,
      });
      delivered++;
    } catch (error) {
      const gone = typeof error?.isGone === "function" && error.isGone();
      if (gone) stale.push(row.endpoint);
      else console.error("Push send failed", error);
    }
  }

  if (stale.length) {
    await adminClient.from("push_subscriptions").delete().in("endpoint", stale);
  }

  return json({ ok: true, delivered, removed: stale.length });
});