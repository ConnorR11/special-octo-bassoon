import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const token = String(Deno.env.get("OPENSOLAR_API_TOKEN") || "").trim();
  const auth = req.headers.get("authorization") || req.headers.get("x-opensolar-token") || "";
  if (!token || (auth !== token && auth !== `Bearer ${token}`)) {
    return json({ success: false, error: "Unauthorized" }, 401);
  }

  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").trim();
  const serviceRoleKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceRoleKey) return json({ success: false, error: "Supabase configuration is missing" }, 500);

  let body: any;
  try { body = await req.json(); } catch { return json({ success: false, error: "Invalid JSON" }, 400); }

  const projectId = String(body?.model_id || "").trim();
  const eventId = String(body?.event_id || "").trim();
  const model = String(body?.model || "").trim();
  const event = String(body?.event || "").toUpperCase();

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: log, error: logError } = await supabase
    .from("integration_event_logs")
    .insert({
      provider: "opensolar",
      integration_name: "OpenSolar Design",
      direction: "inbound",
      event_name: "OpenSolar Design Sync",
      event_type: "webhook",
      external_id: projectId || eventId || null,
      status: "received",
      payload: {
        timestamp: body?.timestamp ?? null,
        identifier: body?.identifier ?? null,
        model,
        model_id: body?.model_id ?? null,
        event,
        event_id: body?.event_id ?? null,
      },
    })
    .select("id")
    .single();

  const logId = log?.id || null;
  if (logError) console.error("Integration log insert failed", logError);

  const finish = async (values: Record<string, unknown>) => {
    if (!logId) return;
    const { error } = await supabase
      .from("integration_event_logs")
      .update({ ...values, processed_at: new Date().toISOString() })
      .eq("id", logId);
    if (error) console.error("Integration log update failed", error);
  };

  if (model.toLowerCase() !== "project" || event === "DELETE") {
    await finish({
      status: "ignored",
      http_status: 200,
      result: { reason: "Unsupported or deleted OpenSolar project event", projectId, event },
    });
    return json({ success: true, ignored: true, projectId, event });
  }

  if (!projectId) {
    await finish({ status: "failed", http_status: 400, error_message: "OpenSolar project ID is missing" });
    return json({ success: false, error: "OpenSolar project ID is missing" }, 400);
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/opensolar-design`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ projectId, source: "webhook", eventId, event }),
    });

    const text = await response.text();
    let result: any;
    try { result = JSON.parse(text); } catch { result = { raw: text }; }

    if (!response.ok || result?.success === false) {
      const message = result?.error || `OpenSolar design sync returned HTTP ${response.status}`;
      await finish({
        status: "failed",
        http_status: response.status,
        error_message: message,
        result: { projectId, eventId, event, syncResponse: result },
      });
      return json({ success: false, error: message, projectId, eventId }, 500);
    }

    await finish({
      status: "success",
      http_status: 200,
      result: {
        projectId,
        eventId,
        event,
        appointmentRowId: result?.appointmentRowId || null,
        systemId: result?.systemId || null,
        arrayCount: result?.arrays?.length || result?.openSolar?.arrays?.length || 0,
      },
    });

    return json({ success: true, projectId, eventId, event, sync: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenSolar webhook sync failed";
    await finish({
      status: "failed",
      http_status: 500,
      error_message: message,
      result: { projectId, eventId, event },
    });
    return json({ success: false, error: message, projectId, eventId }, 500);
  }
});
