import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = process.env.GLIDE_LEAD_API_KEY;

// Every leads-table column except the two composite primary-key columns.
// Identifiers must be supplied separately and cannot be changed by the payload.
const EDITABLE_FIELDS = new Set([
  "time_archived","reason_for_archive","on_call","sent_to_sales","lead_source","lead_type",
  "disposition","archive_disposition","last_disposition","ip_address","appointment_date_time",
  "salutations","first_name","last_name","primary_phone_number","email","address","postcode",
  "dispositioned_by","marketing_note","secondary_phone_number","age","employment_status",
  "conservation_status","callback_date_time","callback_canvasser","last_time_called","last_called_by",
  "first_time_called","first_called_by","first_Allocated","first_allocated_to","booked_by","measure",
  "biter","cps_c","cps_p","cps_s","sales_result","net","marketing_note_sales_app","sales_note",
  "updated_by","passed_to_sales","reason_for_return","appointment_date_sales_app","last_call_note",
  "call_counter","appointment_product","invalid","trade_disposition","trade_note",
  "trade_was_rep_on_time","trade_was_rep_polite","trade_did_rep_show_window",
  "trade_did_rep_leave_price","trade_price_left","call_note","brevo_update","potentially_vulnerable",
  "introducer","hotkey_status","eco4_on_call","eco4_disposition","eco4_qualified_by",
  "eco4_last_disposition","data_match_unsigned_file","data_match_file_sent_time",
  "data_match_file_resent_time","data_match_signed_file","data_match_signed_time","data_match_status",
  "eco4_call_back_date","eco4_call_back_canvasser","eco4_appointment_date","eco4_appointment_booked_by",
  "eco4_appointment_booked_time","eco4_notes","eco4_previous_notes","eco4_measure",
  "eco4_last_time_called","eco4_first_time_called","eco4_lead_two_hour_cutoff","eco4_last_called_by",
  "eco4_status","eco4_date_uploaded","eco4_date_processed","eco4_urn","eco4_on_benefits",
  "eco4_benefit_recipient_name","eco4_dob","eco4_sent_to_pipedrive","eco4_boiler_age",
  "eco4_heating_type","eco4_window_age","eco4_cavity_wall","eco4_solar_panels","eco4_heat_pump",
  "areas_of_concern","eco4_house_type","pronto_c1","pronto_c2","pronto_c3","website_source",
  "website_source_url","first_booked_date_time","first_booked_calls_to_booked","trade_two_hour_cutoff",
  "trade_last_time_called","trade_callback_date","trade_appointment_date","received_at","call_count",
  "last_called_at","claimed_by","claimed_at","claim_expires_at","created_at","received_date_time","pronto_SID"
]);

function reply(res, status, body) {
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return reply(res, 405, { ok: false, error: "Method not allowed. Use POST." });
  }
  if (!apiKey || !supabaseUrl || !serviceKey) {
    console.error("Glide lead API missing required environment configuration.");
    return reply(res, 500, { ok: false, error: "API is not configured." });
  }

  const providedKey = req.headers["x-api-key"];
  if (typeof providedKey !== "string" || providedKey.length !== apiKey.length ||
      !cryptoSafeEqual(providedKey, apiKey)) {
    return reply(res, 401, { ok: false, error: "Invalid API key." });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return reply(res, 400, { ok: false, error: "Request body must be a JSON object." });
    }
    const deleteRowId = String(body.delete_row_id || "").trim();
    const marketingRowId = String(body.marketing_row_id || "").trim();
    const fields = body.fields;

    if (!deleteRowId || !marketingRowId) {
      return reply(res, 400, { ok: false, error: "Both delete_row_id and marketing_row_id are required to identify a lead." });
    }
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
      return reply(res, 400, { ok: false, error: 'Provide a "fields" object containing the values to update.' });
    }
    const keys = Object.keys(fields);
    if (!keys.length) {
      return reply(res, 400, { ok: false, error: "No fields supplied to update." });
    }
    const invalid = keys.filter(key => !EDITABLE_FIELDS.has(key));
    if (invalid.length) {
      return reply(res, 400, { ok: false, error: "Unknown or protected fields supplied.", fields: invalid });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data, error } = await supabase
      .from("leads")
      .update(fields)
      .eq("delete_row_id", deleteRowId)
      .eq("marketing_row_id", marketingRowId)
      .select("delete_row_id,marketing_row_id");

    if (error) {
      console.error("Glide lead update failed:", error.message);
      return reply(res, 500, { ok: false, error: "Database update failed." });
    }
    if (!data || data.length === 0) {
      return reply(res, 404, { ok: false, error: "No lead found for that identifier pair. No changes were made." });
    }
    return reply(res, 200, {
      ok: true,
      updated: true,
      lead: { delete_row_id: data[0].delete_row_id, marketing_row_id: data[0].marketing_row_id },
      updated_fields: keys
    });
  } catch (error) {
    console.error("Glide lead API request failed:", error?.message || error);
    return reply(res, 400, { ok: false, error: "Invalid JSON or malformed request." });
  }
}

function cryptoSafeEqual(a, b) {
  // Constant-time comparison for equal-length API keys.
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
