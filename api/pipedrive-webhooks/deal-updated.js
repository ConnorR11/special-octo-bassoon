function send(res, status, body) {
  res.status(status).json(body)
}

function getHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body

  let raw = ""

  for await (const chunk of req) {
    raw += chunk
  }

  try {
    return JSON.parse(raw || "{}")
  } catch {
    return {}
  }
}

function validBasicAuth(req, username, password) {
  if (!username || !password) return true

  const header = String(getHeader(req, "authorization") || "")

  if (!header.toLowerCase().startsWith("basic ")) return false

  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8")
    const separator = decoded.indexOf(":")

    if (separator < 0) return false

    return (
      decoded.slice(0, separator) === username &&
      decoded.slice(separator + 1) === password
    )
  } catch {
    return false
  }
}

async function logEvent(supabaseUrl, serviceRoleKey, values) {
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/integration_event_logs`,
      {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          provider: "pipedrive",
          integration_name: "Pipedrive Webhooks",
          direction: "inbound",
          event_name: values.eventName || "deal.updated",
          event_type: values.eventType || "webhook",
          external_id: values.externalId || null,
          status: values.status || "received",
          http_status: values.httpStatus || null,
          error_message: values.errorMessage || null,
          payload: values.payload || null,
          result: values.result || null,
          processed_at: values.processedAt || null,
        }),
      }
    )

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      console.error(
        "Pipedrive integration log failed:",
        response.status,
        text
      )
    }
  } catch (error) {
    console.error("Pipedrive integration log failed:", error)
  }
}


/*
|--------------------------------------------------------------------------
| PIPEDRIVE FIELDS
|--------------------------------------------------------------------------
*/

const PIPEDRIVE_FIELDS = {
  installationStartDate: {
    name: "Installation: Start Date",
    key: "55177af32aecef5d2f250bd701c2bbee064136fc",
  },

  fitTeam: {
    name: "Installation: Fit Team",
    key: "9dea8a18f5fe439880a93a49c0be9072f7d38107",
  },

  installationIssuesFitTeam: {
    name: "Installation Issues: Fit Team",
    key: "5de8dad128c17a2be90d25241b9cf758cf5000b9",
  },

  installationIssuesStartDate: {
    name: "Installation: Installation Issue Booked",
    key: "ca19ff895b86a67552d6b600ed15ad6ffcd771ea",
  },

  surveyCosting: {
    name: "Survey: Costing",
    key: null,
  },

  commissionPaidDate: {
    name: "Comms | Rep Comms Paid Date",
    key: null,
  },

  estimatedCommissionDue: {
    name: "Comms | Est Rep Comms",
    key: null,
  },

  adminFeeAmount: {
    name: "AF: Price",
    key: null,
  },

  adminFeeExpectedDate: {
    name: "AF: Expected Payment Date",
    key: null,
  },

  adminFeeMethod: {
    name: "AF: Payment Method",
    key: null,
  },

  adminFeePaidOutDate: {
    name: "Comms | Admin Paid Out Date",
    key: null,
  },

  adminFeeReceivedDate: {
    name: "AF: Date Received",
    key: null,
  },

  salesperson: {
    name: "Sales Rep",
    key: null,
  },

  balanceOutstanding: {
    name: "Balance: Outstanding Amount",
    key: null,
  },

  estimatedPaymentDate: {
    name: "Installations: Estimated Payment Date",
    key: null,
  },

  /*
  |--------------------------------------------------------------------------
  | NEW FIELDS
  |--------------------------------------------------------------------------
  */

  installationRoofStartDate: {
    name: "Installation: Roof Start Date",
    key: null,
  },

  installationRoofTeam: {
    name: "Installation: Roof Installation Team",
    key: null,
  },

  installationElectricsStartDate: {
    name: "Installation: Electrics Start Date",
    key: null,
  },

  installationElectricsTeam: {
    name: "Installation: Electrics Installation Team",
    key: null,
  },

  remedialStartDate: {
    name: "Remedial: Start Date",
    key: null,
  },

  remedialFitTeam: {
    name: "Remedial: Fit Team",
    key: null,
  },
}


/*
|--------------------------------------------------------------------------
| CACHES
|--------------------------------------------------------------------------
*/

let fieldResolutionPromise = null
let usersResolutionPromise = null

const userNameCache = new Map()


/*
|--------------------------------------------------------------------------
| RESOLVE PIPEDRIVE FIELD CODES
|--------------------------------------------------------------------------
*/

async function resolveMissingFieldCodes(pipedriveToken) {
  const missing = Object.values(PIPEDRIVE_FIELDS).filter(
    (field) => !field.key
  )

  if (!missing.length) {
    return PIPEDRIVE_FIELDS
  }

  if (!fieldResolutionPromise) {
    fieldResolutionPromise = (async () => {
      const response = await fetch(
        `https://api.pipedrive.com/api/v2/dealFields?limit=500&api_token=${encodeURIComponent(
          pipedriveToken
        )}`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      )

      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.success) {
        throw new Error(
          json?.error ||
            `Pipedrive deal fields lookup failed with HTTP ${response.status}.`
        )
      }

      const fields = Array.isArray(json.data) ? json.data : []

      for (const target of missing) {
        const match = fields.find((field) => {
          const name = String(
            field?.field_name || field?.name || ""
          )
            .trim()
            .toLowerCase()

          return name === target.name.toLowerCase()
        })

        const key = String(
          match?.field_code || match?.key || ""
        ).trim()

        if (key) {
          target.key = key
        }
      }

      return PIPEDRIVE_FIELDS
    })().catch((error) => {
      fieldResolutionPromise = null
      throw error
    })
  }

  return fieldResolutionPromise
}


/*
|--------------------------------------------------------------------------
| PIPEDRIVE VALUE HELPERS
|--------------------------------------------------------------------------
*/

function getCustomFieldValue(deal, key) {
  if (!key) return null

  const customFields = deal?.custom_fields

  if (
    customFields &&
    typeof customFields === "object"
  ) {
    return customFields[key] ?? null
  }

  return deal?.[key] ?? null
}

function unwrapValue(value) {
  let current = value

  for (let i = 0; i < 5; i += 1) {
    if (current === null || current === undefined) {
      return null
    }

    if (
      typeof current !== "object" ||
      Array.isArray(current)
    ) {
      return current
    }

    if (
      Object.prototype.hasOwnProperty.call(
        current,
        "value"
      )
    ) {
      current = current.value
      continue
    }

    if (
      Object.prototype.hasOwnProperty.call(
        current,
        "date"
      )
    ) {
      current = current.date
      continue
    }

    if (
      Object.prototype.hasOwnProperty.call(
        current,
        "start_date"
      )
    ) {
      current = current.start_date
      continue
    }

    return current
  }

  return current
}

function normaliseDate(value) {
  const unwrapped = unwrapValue(value)

  if (
    unwrapped === null ||
    unwrapped === undefined ||
    unwrapped === ""
  ) {
    return null
  }

  const text = String(unwrapped).trim()

  if (!text) return null

  const isoMatch = text.match(/^(\d{4}-\d{2}-\d{2})/)

  if (isoMatch) {
    return isoMatch[1]
  }

  const ukMatch = text.match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/
  )

  if (ukMatch) {
    return `${ukMatch[3]}-${ukMatch[2].padStart(
      2,
      "0"
    )}-${ukMatch[1].padStart(2, "0")}`
  }

  const parsed = new Date(text)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString().slice(0, 10)
}

function normaliseNumber(value) {
  const unwrapped = unwrapValue(value)

  if (
    unwrapped === null ||
    unwrapped === undefined ||
    unwrapped === ""
  ) {
    return null
  }

  const number = Number(
    String(unwrapped).replace(/[^0-9.-]/g, "")
  )

  return Number.isFinite(number) ? number : null
}

function normaliseText(value) {
  const unwrapped = unwrapValue(value)

  if (
    unwrapped === null ||
    unwrapped === undefined ||
    unwrapped === ""
  ) {
    return null
  }

  if (typeof unwrapped === "object") {
    return (
      String(
        unwrapped.label ??
          unwrapped.name ??
          unwrapped.value ??
          ""
      ).trim() || null
    )
  }

  return String(unwrapped).trim() || null
}

function normaliseFitTeam(value) {
  return normaliseText(value)
}


/*
|--------------------------------------------------------------------------
| PIPEDRIVE API LOOKUPS
|--------------------------------------------------------------------------
*/

async function getStageName(
  pipedriveToken,
  stageId
) {
  if (!stageId) return null

  const response = await fetch(
    `https://api.pipedrive.com/api/v2/stages/${encodeURIComponent(
      stageId
    )}?api_token=${encodeURIComponent(
      pipedriveToken
    )}`,
    {
      headers: {
        Accept: "application/json",
      },
    }
  )

  const json = await response.json().catch(() => ({}))

  if (!response.ok || !json?.success) {
    return null
  }

  return (
    String(json?.data?.name || "").trim() ||
    null
  )
}

async function getPersonName(
  pipedriveToken,
  personId
) {
  if (!personId) return null

  const response = await fetch(
    `https://api.pipedrive.com/api/v2/persons/${encodeURIComponent(
      personId
    )}?api_token=${encodeURIComponent(
      pipedriveToken
    )}`,
    {
      headers: {
        Accept: "application/json",
      },
    }
  )

  const json = await response.json().catch(() => ({}))

  if (!response.ok || !json?.success) {
    return null
  }

  return (
    String(json?.data?.name || "").trim() ||
    null
  )
}

async function getUserName(
  pipedriveToken,
  userId
) {
  const id = String(userId ?? "").trim()

  if (!id) return null

  if (userNameCache.has(id)) {
    return userNameCache.get(id)
  }

  try {
    const directResponse = await fetch(
      `https://api.pipedrive.com/api/v1/users/${encodeURIComponent(
        id
      )}?api_token=${encodeURIComponent(
        pipedriveToken
      )}`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    )

    const directJson =
      await directResponse.json().catch(() => ({}))

    const directName = String(
      directJson?.data?.name || ""
    ).trim()

    if (
      directResponse.ok &&
      directJson?.success &&
      directName
    ) {
      userNameCache.set(id, directName)
      return directName
    }
  } catch {
    // Continue to users lookup
  }

  if (!usersResolutionPromise) {
    usersResolutionPromise = (async () => {
      const response = await fetch(
        `https://api.pipedrive.com/api/v1/users?limit=500&api_token=${encodeURIComponent(
          pipedriveToken
        )}`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      )

      const json =
        await response.json().catch(() => ({}))

      if (!response.ok || !json?.success) {
        throw new Error(
          json?.error ||
            `Pipedrive users lookup failed with HTTP ${response.status}.`
        )
      }

      const users = Array.isArray(json.data)
        ? json.data
        : []

      for (const user of users) {
        const userId = String(
          user?.id ?? ""
        ).trim()

        const name = String(
          user?.name || ""
        ).trim()

        if (userId && name) {
          userNameCache.set(userId, name)
        }
      }

      return users
    })().catch((error) => {
      usersResolutionPromise = null
      throw error
    })
  }

  await usersResolutionPromise

  return userNameCache.get(id) || null
}

async function getSalespersonName(
  pipedriveToken,
  value
) {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    const directName = String(
      value.name || value.label || ""
    ).trim()

    if (directName) {
      return directName
    }
  }

  const unwrapped = unwrapValue(value)

  if (
    unwrapped === null ||
    unwrapped === undefined ||
    unwrapped === ""
  ) {
    return null
  }

  const userId =
    typeof unwrapped === "object"
      ? (
          unwrapped.id ??
          unwrapped.user_id ??
          unwrapped.value
        )
      : unwrapped

  const text = String(userId ?? "").trim()

  if (!text) return null

  if (/^\d+$/.test(text)) {
    return await getUserName(
      pipedriveToken,
      text
    )
  }

  return text
}


/*
|--------------------------------------------------------------------------
| MAIN WEBHOOK
|--------------------------------------------------------------------------
*/

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return send(res, 405, {
      success: false,
      error: "Method not allowed",
    })
  }

  const supabaseUrl = String(
    process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      ""
  ).trim()

  const serviceRoleKey = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  ).trim()

  const pipedriveToken = String(
    process.env.PIPEDRIVE_API_TOKEN || ""
  ).trim()

  const webhookUsername = String(
    process.env.PIPEDRIVE_WEBHOOK_USERNAME || ""
  ).trim()

  const webhookPassword = String(
    process.env.PIPEDRIVE_WEBHOOK_PASSWORD || ""
  ).trim()

  /*
  |--------------------------------------------------------------------------
  | READ WEBHOOK
  |--------------------------------------------------------------------------
  */

  const body = await readBody(req)

  const event =
    body?.event ||
    body?.meta?.event ||
    "deal.updated"

  const dealId = String(
    body?.data?.item?.id ??
      body?.data?.item?.deal_id ??
      body?.data?.id ??
      body?.item?.id ??
      ""
  ).trim()

  const receivedAt = new Date().toISOString()

  const baseLog = {
    eventName: event,
    eventType: "deal",
    externalId: dealId || null,
    payload: body,
  }

  /*
  |--------------------------------------------------------------------------
  | VERY EARLY LOG
  |
  | This confirms that the webhook has actually reached Vercel.
  |--------------------------------------------------------------------------
  */

  if (supabaseUrl && serviceRoleKey) {
    await logEvent(
      supabaseUrl,
      serviceRoleKey,
      {
        ...baseLog,
        status: "received",
        httpStatus: 200,
        result: {
          message:
            "Pipedrive webhook received.",
          dealId: dealId || null,
        },
        processedAt: receivedAt,
      }
    )
  }

  /*
  |--------------------------------------------------------------------------
  | ENVIRONMENT CHECK
  |--------------------------------------------------------------------------
  */

  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    !pipedriveToken
  ) {
    return send(res, 500, {
      success: false,
      error:
        "Pipedrive integration environment variables are not configured.",
    })
  }

  /*
  |--------------------------------------------------------------------------
  | AUTH
  |--------------------------------------------------------------------------
  */

  if (
    !validBasicAuth(
      req,
      webhookUsername,
      webhookPassword
    )
  ) {
    res.setHeader(
      "WWW-Authenticate",
      'Basic realm="Pipedrive Webhook"'
    )

    await logEvent(
      supabaseUrl,
      serviceRoleKey,
      {
        ...baseLog,
        status: "failed",
        httpStatus: 401,
        errorMessage:
          "Invalid webhook credentials.",
        processedAt: new Date().toISOString(),
      }
    )

    return send(res, 401, {
      success: false,
      error: "Invalid webhook credentials.",
    })
  }

  /*
  |--------------------------------------------------------------------------
  | NO DEAL ID
  |--------------------------------------------------------------------------
  */

  if (!dealId) {
    await logEvent(
      supabaseUrl,
      serviceRoleKey,
      {
        ...baseLog,
        status: "ignored",
        httpStatus: 200,
        result: {
          reason:
            "No deal ID in webhook payload",
        },
        processedAt: new Date().toISOString(),
      }
    )

    return send(res, 200, {
      success: true,
      ignored: true,
      reason:
        "No deal ID in webhook payload",
    })
  }

  /*
  |--------------------------------------------------------------------------
  | PROCESS DEAL
  |--------------------------------------------------------------------------
  */

  try {
    const fields =
      await resolveMissingFieldCodes(
        pipedriveToken
      )

    /*
    |--------------------------------------------------------------------------
    | IMPORTANT:
    |
    | Pipedrive only allows 15 custom_fields in
    | the deal lookup.
    |
    | We now split the requests into batches of
    | 15 rather than sending everything at once.
    |--------------------------------------------------------------------------
    */

    const customFieldEntries = Object.entries(
      fields
    ).filter(
      ([, field]) => Boolean(field.key)
    )

    const fieldBatches = []

    for (
      let i = 0;
      i < customFieldEntries.length;
      i += 15
    ) {
      fieldBatches.push(
        customFieldEntries.slice(
          i,
          i + 15
        )
      )
    }

    let deal = null

    /*
    |--------------------------------------------------------------------------
    | Fetch deal.
    |
    | We make the first request with the first 15
    | fields and then, if necessary, fetch additional
    | fields separately.
    |--------------------------------------------------------------------------
    */

    for (
      let batchIndex = 0;
      batchIndex < fieldBatches.length;
      batchIndex += 1
    ) {
      const batch = fieldBatches[
        batchIndex
      ]

      const dealUrl = new URL(
        `https://api.pipedrive.com/api/v2/deals/${encodeURIComponent(
          dealId
        )}`
      )

      dealUrl.searchParams.set(
        "api_token",
        pipedriveToken
      )

      dealUrl.searchParams.set(
        "custom_fields",
        batch
          .map(([, field]) => field.key)
          .join(",")
      )

      dealUrl.searchParams.set(
        "include_option_labels",
        "true"
      )

      const dealResponse = await fetch(
        dealUrl.toString(),
        {
          headers: {
            Accept: "application/json",
          },
        }
      )

      const dealJson =
        await dealResponse
          .json()
          .catch(() => ({}))

      if (
        !dealResponse.ok ||
        !dealJson?.success
      ) {
        const message =
          dealJson?.error ||
          `Pipedrive deal lookup failed with HTTP ${dealResponse.status}.`

        await logEvent(
          supabaseUrl,
          serviceRoleKey,
          {
            ...baseLog,
            status: "failed",
            httpStatus:
              dealResponse.status,
            errorMessage: message,
            result: {
              dealId,
              batchIndex,
              fieldsRequested:
                batch.map(
                  ([key]) => key
                ),
            },
            processedAt:
              new Date().toISOString(),
          }
        )

        return send(res, 502, {
          success: false,
          error: message,
        })
      }

      const batchDeal =
        dealJson.data || {}

      if (!deal) {
        deal = batchDeal
      } else {
        /*
        |--------------------------------------------------------------------------
        | Merge custom fields returned from
        | subsequent batches.
        |--------------------------------------------------------------------------
        */

        deal.custom_fields = {
          ...(deal.custom_fields || {}),
          ...(batchDeal.custom_fields ||
            {}),
        }
      }
    }

    deal = deal || {}

    /*
    |--------------------------------------------------------------------------
    | EXTRACT FIELDS
    |--------------------------------------------------------------------------
    */

    const installationStartDate =
      normaliseDate(
        getCustomFieldValue(
          deal,
          fields.installationStartDate.key
        )
      )

    const fitTeam1 =
      normaliseFitTeam(
        getCustomFieldValue(
          deal,
          fields.fitTeam.key
        )
      )

    const installationIssuesFitTeam =
      normaliseFitTeam(
        getCustomFieldValue(
          deal,
          fields.installationIssuesFitTeam
            .key
        )
      )

    const installationsIssuesStartDate =
      normaliseDate(
        getCustomFieldValue(
          deal,
          fields.installationIssuesStartDate
            .key
        )
      )

    const surveyCosting =
      normaliseNumber(
        getCustomFieldValue(
          deal,
          fields.surveyCosting.key
        )
      )

    const commissionPaidDate =
      normaliseDate(
        getCustomFieldValue(
          deal,
          fields.commissionPaidDate.key
        )
      )

    const estimatedCommissionDue =
      normaliseNumber(
        getCustomFieldValue(
          deal,
          fields.estimatedCommissionDue.key
        )
      )

    const adminFeeAmount =
      normaliseNumber(
        getCustomFieldValue(
          deal,
          fields.adminFeeAmount.key
        )
      )

    const adminFeeExpectedDate =
      normaliseDate(
        getCustomFieldValue(
          deal,
          fields.adminFeeExpectedDate.key
        )
      )

    const adminFeeMethod =
      normaliseText(
        getCustomFieldValue(
          deal,
          fields.adminFeeMethod.key
        )
      )

    const adminFeePaidOutDate =
      normaliseDate(
        getCustomFieldValue(
          deal,
          fields.adminFeePaidOutDate.key
        )
      )

    const adminFeeReceivedDate =
      normaliseDate(
        getCustomFieldValue(
          deal,
          fields.adminFeeReceivedDate.key
        )
      )

    const balanceOutstanding =
      normaliseNumber(
        getCustomFieldValue(
          deal,
          fields.balanceOutstanding.key
        )
      )

    const estimatedPaymentDate =
      normaliseDate(
        getCustomFieldValue(
          deal,
          fields.estimatedPaymentDate.key
        )
      )

    /*
    |--------------------------------------------------------------------------
    | NEW INSTALLATION / REMEDIAL FIELDS
    |--------------------------------------------------------------------------
    */

    const installationRoofStartDate =
      normaliseDate(
        getCustomFieldValue(
          deal,
          fields.installationRoofStartDate
            .key
        )
      )

    const installationRoofTeam =
      normaliseFitTeam(
        getCustomFieldValue(
          deal,
          fields.installationRoofTeam.key
        )
      )

    const installationElectricsStartDate =
      normaliseDate(
        getCustomFieldValue(
          deal,
          fields.installationElectricsStartDate
            .key
        )
      )

    const installationElectricsTeam =
      normaliseFitTeam(
        getCustomFieldValue(
          deal,
          fields.installationElectricsTeam
            .key
        )
      )

    const remedialStartDate =
      normaliseDate(
        getCustomFieldValue(
          deal,
          fields.remedialStartDate.key
        )
      )

    const remedialFitTeam =
      normaliseFitTeam(
        getCustomFieldValue(
          deal,
          fields.remedialFitTeam.key
        )
      )

    /*
    |--------------------------------------------------------------------------
    | SALESPERSON
    |--------------------------------------------------------------------------
    */

    const salespersonRaw =
      getCustomFieldValue(
        deal,
        fields.salesperson.key
      )

    const salespersonValue =
      unwrapValue(salespersonRaw)

    const salesperson =
      salespersonValue &&
      typeof salespersonValue ===
        "object"
        ? String(
            salespersonValue.id ??
              salespersonValue.user_id ??
              salespersonValue.value ??
              ""
          ).trim() || null
        : salespersonValue ===
              null ||
            salespersonValue ===
              undefined ||
            salespersonValue === ""
          ? null
          : String(
              salespersonValue
            ).trim()

    /*
    |--------------------------------------------------------------------------
    | STAGE / CUSTOMER
    |--------------------------------------------------------------------------
    */

    const pipedriveStage =
      (await getStageName(
        pipedriveToken,
        deal?.stage_id
      )) ||
      String(
        deal?.stage_name ||
          deal?.stage?.name ||
          ""
      ).trim() ||
      null

    const personId =
      deal?.person_id?.value ??
      deal?.person_id ??
      null

    const customerName =
      (await getPersonName(
        pipedriveToken,
        personId
      )) ||
      String(
        deal?.person_name ||
          deal?.person?.name ||
          ""
      ).trim() ||
      null

    /*
    |--------------------------------------------------------------------------
    | FRIENDLY LOG DATA
    |--------------------------------------------------------------------------
    */

    const friendlyFields = {
      Customer: customerName,

      "Installation: Start Date":
        installationStartDate,

      "Installation: Fit Team":
        fitTeam1,

      "Installation Issues: Fit Team":
        installationIssuesFitTeam,

      "Installation: Installation Issue Booked":
        installationsIssuesStartDate,

      "Survey: Costing":
        surveyCosting,

      "Comms | Rep Comms Paid Date":
        commissionPaidDate,

      "Comms | Est Rep Comms":
        estimatedCommissionDue,

      "AF: Price":
        adminFeeAmount,

      "AF: Expected Payment Date":
        adminFeeExpectedDate,

      "AF: Payment Method":
        adminFeeMethod,

      "Comms | Admin Paid Out Date":
        adminFeePaidOutDate,

      "AF: Date Received":
        adminFeeReceivedDate,

      "Sales Rep":
        salesperson,

      "Balance: Outstanding Amount":
        balanceOutstanding,

      "Installations: Estimated Payment Date":
        estimatedPaymentDate,

      "Installation: Roof Start Date":
        installationRoofStartDate,

      "Installation: Roof Installation Team":
        installationRoofTeam,

      "Installation: Electrics Start Date":
        installationElectricsStartDate,

      "Installation: Electrics Installation Team":
        installationElectricsTeam,

      "Remedial: Start Date":
        remedialStartDate,

      "Remedial: Fit Team":
        remedialFitTeam,

      Stage: pipedriveStage,
    }

    const fieldCodes =
      Object.fromEntries(
        Object.entries(fields).map(
          ([key, field]) => [
            field.name,
            field.key,
          ]
        )
      )

    /*
    |--------------------------------------------------------------------------
    | SANITISE WEBHOOK PAYLOAD
    |--------------------------------------------------------------------------
    */

    const sanitizedBody =
      JSON.parse(
        JSON.stringify(body || {})
      )

    if (
      sanitizedBody?.data?.item
        ?.custom_fields
    ) {
      for (const field of Object.values(
        fields
      )) {
        if (field.key) {
          delete sanitizedBody.data.item
            .custom_fields[field.key]
        }
      }
    }

    const payloadForLog = {
      ...sanitizedBody,
      pipedrive_fields:
        friendlyFields,
      pipedrive_field_codes:
        fieldCodes,
    }

    const logBase = {
      ...baseLog,
      payload: payloadForLog,
    }

    /*
    |--------------------------------------------------------------------------
    | FIND CRM DEAL
    |--------------------------------------------------------------------------
    */

    const select =
      [
        "id",
        "pipedrive_deal_id",
        "customer_name",
        "installation_start_date",
        "fit_team_1",
        "installation_issues_fit_team",
        "installations_issues_start_date",
        "survey_costing",
        "commission_paid_date",
        "estimated_commission_due",
        "admin_fee_amount",
        "admin_fee_expected_date",
        "admin_fee_method",
        "admin_fee_paid_out_date",
        "admin_fee_received_date",
        "balance_outstanding",
        "estimated_payment_date",
        "pipedrive_stage",
        "salesperson",
        "installation_roof_start_date",
        "installation_roof_team",
        "installation_electrics_start_date",
        "installation_electrics_team",
        "remedial_start_date",
        "remedial_fit_team",
      ].join(",")

    const lookup =
      await fetch(
        `${supabaseUrl}/rest/v1/deals?pipedrive_deal_id=eq.${encodeURIComponent(
          dealId
        )}&select=${select}`,
        {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            Accept:
              "application/json",
          },
        }
      )

    const existingDeals =
      await lookup
        .json()
        .catch(() => [])

    if (!lookup.ok) {
      const message =
        Array.isArray(existingDeals)
          ? "CRM deal lookup failed."
          : String(
              existingDeals?.message ||
                existingDeals?.error ||
                "CRM deal lookup failed."
            )

      await logEvent(
        supabaseUrl,
        serviceRoleKey,
        {
          ...logBase,
          status: "failed",
          httpStatus: lookup.status,
          errorMessage: message,
          result: {
            dealId,
          },
          processedAt:
            new Date().toISOString(),
        }
      )

      return send(res, 500, {
        success: false,
        error: message,
      })
    }

    /*
    |--------------------------------------------------------------------------
    | NO MATCH
    |--------------------------------------------------------------------------
    */

    if (
      !Array.isArray(existingDeals) ||
      existingDeals.length !== 1
    ) {
      const result = {
        reason:
          "No matching CRM deal by Pipedrive deal ID",
        dealId,
        customerName,
        installationStartDate,
        fitTeam1,
        installationIssuesFitTeam,
        installationsIssuesStartDate,
        surveyCosting,
        commissionPaidDate,
        estimatedCommissionDue,
        adminFeeAmount,
        adminFeeExpectedDate,
        adminFeeMethod,
        adminFeePaidOutDate,
        adminFeeReceivedDate,
        balanceOutstanding,
        estimatedPaymentDate,
        installationRoofStartDate,
        installationRoofTeam,
        installationElectricsStartDate,
        installationElectricsTeam,
        remedialStartDate,
        remedialFitTeam,
        pipedriveStage,
      }

      await logEvent(
        supabaseUrl,
        serviceRoleKey,
        {
          ...logBase,
          status: "ignored",
          httpStatus: 200,
          result,
          processedAt:
            new Date().toISOString(),
        }
      )

      return send(res, 200, {
        success: true,
        updated: false,
        ...result,
      })
    }

    /*
    |--------------------------------------------------------------------------
    | UPDATE CRM DEAL
    |--------------------------------------------------------------------------
    */

    const matchedDeal =
      existingDeals[0]

    const updatePayload = {
      pipedrive_deal_id:
        Number(dealId),

      customer_name:
        customerName,

      salesperson,

      installation_start_date:
        installationStartDate,

      fit_team_1:
        fitTeam1,

      installation_issues_fit_team:
        installationIssuesFitTeam,

      installations_issues_start_date:
        installationsIssuesStartDate,

      survey_costing:
        surveyCosting,

      commission_paid_date:
        commissionPaidDate,

      estimated_commission_due:
        estimatedCommissionDue,

      admin_fee_amount:
        adminFeeAmount,

      admin_fee_expected_date:
        adminFeeExpectedDate,

      admin_fee_method:
        adminFeeMethod,

      admin_fee_paid_out_date:
        adminFeePaidOutDate,

      admin_fee_received_date:
        adminFeeReceivedDate,

      balance_outstanding:
        balanceOutstanding,

      estimated_payment_date:
        estimatedPaymentDate,

      pipedrive_stage:
        pipedriveStage,

      /*
      |--------------------------------------------------------------------------
      | NEW FIELDS
      |--------------------------------------------------------------------------
      */

      installation_roof_start_date:
        installationRoofStartDate,

      installation_roof_team:
        installationRoofTeam,

      installation_electrics_start_date:
        installationElectricsStartDate,

      installation_electrics_team:
        installationElectricsTeam,

      remedial_start_date:
        remedialStartDate,

      remedial_fit_team:
        remedialFitTeam,

      updated_at:
        new Date().toISOString(),
    }

    const updateResponse =
      await fetch(
        `${supabaseUrl}/rest/v1/deals?id=eq.${encodeURIComponent(
          matchedDeal.id
        )}`,
        {
          method: "PATCH",
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type":
              "application/json",
            Prefer:
              "return=representation",
          },
          body: JSON.stringify(
            updatePayload
          ),
        }
      )

    const updated =
      await updateResponse
        .json()
        .catch(() => [])

    if (!updateResponse.ok) {
      const message =
        Array.isArray(updated)
          ? "CRM deal update failed."
          : String(
              updated?.message ||
                updated?.error ||
                "CRM deal update failed."
            )

      await logEvent(
        supabaseUrl,
        serviceRoleKey,
        {
          ...logBase,
          status: "failed",
          httpStatus:
            updateResponse.status,
          errorMessage: message,
          result: {
            dealId,
            matchedBy:
              "pipedrive_deal_id",
            crmDealId:
              matchedDeal.id,
            updatePayload,
          },
          processedAt:
            new Date().toISOString(),
        }
      )

      return send(res, 500, {
        success: false,
        error: message,
      })
    }

    /*
    |--------------------------------------------------------------------------
    | SUCCESS RESULT
    |--------------------------------------------------------------------------
    */

    const result = {
      dealId,

      crmDealId:
        matchedDeal.id,

      matchedBy:
        "pipedrive_deal_id",

      customerName,

      salesperson,

      installationStartDate,

      fitTeam1,

      installationIssuesFitTeam,

      installationsIssuesStartDate,

      surveyCosting,

      commissionPaidDate,

      estimatedCommissionDue,

      adminFeeAmount,

      adminFeeExpectedDate,

      adminFeeMethod,

      adminFeePaidOutDate,

      adminFeeReceivedDate,

      balanceOutstanding,

      estimatedPaymentDate,

      /*
      |--------------------------------------------------------------------------
      | NEW FIELDS
      |--------------------------------------------------------------------------
      */

      installationRoofStartDate,

      installationRoofTeam,

      installationElectricsStartDate,

      installationElectricsTeam,

      remedialStartDate,

      remedialFitTeam,

      pipedriveStage,

      updatedRows:
        Array.isArray(updated)
          ? updated.length
          : 0,

      receivedAt,
    }

    await logEvent(
      supabaseUrl,
      serviceRoleKey,
      {
        ...logBase,
        status: "success",
        httpStatus: 200,
        result,
        processedAt:
          new Date().toISOString(),
      }
    )

    return send(res, 200, {
      success: true,
      ...result,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected Pipedrive webhook error."

    console.error(
      "Pipedrive webhook error:",
      error
    )

    if (
      supabaseUrl &&
      serviceRoleKey
    ) {
      await logEvent(
        supabaseUrl,
        serviceRoleKey,
        {
          ...baseLog,
          status: "failed",
          httpStatus: 500,
          errorMessage: message,
          result: {
            dealId,
          },
          processedAt:
            new Date().toISOString(),
        }
      )
    }

    return send(res, 500, {
      success: false,
      error: message,
    })
  }
}
