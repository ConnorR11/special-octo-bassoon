import { createIntegrationLog, updateIntegrationLog } from "../_integration-log.js"
import { getAccessToken, googleBusinessRequest, parseCookies } from "./_google-reviews.js"

const CONFIG_EVENT_NAME = "google-reviews-location-config"

function supabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase server credentials are not configured.")
  return { supabaseUrl: supabaseUrl.replace(/\/$/, ""), serviceRoleKey }
}

async function saveLocation(location) {
  const log = await createIntegrationLog({
    provider: "google",
    integrationName: "Google Reviews",
    direction: "outbound",
    eventName: CONFIG_EVENT_NAME,
    eventType: "configuration",
    externalId: location.locationName,
    payload: {
      accountName: location.accountName,
      locationName: location.locationName,
      status: "configured",
      source: "manual_crm_discovery",
    },
  })
  if (log?.id) {
    await updateIntegrationLog(log.id, {
      status: "success",
      http_status: 200,
      result: location,
    })
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).json({ error: "Method not allowed" })

  let log = null
  try {
    log = await createIntegrationLog({
      provider: "google",
      integrationName: "Google Reviews",
      direction: "outbound",
      eventName: "google-reviews-location-discovery",
      eventType: "configuration",
      payload: { action: "discover_location", status: "started" },
    })

    const refreshToken = parseCookies(req.headers.cookie).google_reviews_refresh_token
    if (!refreshToken) {
      const error = new Error("Google Reviews is not connected. Connect Google Reviews first.")
      error.status = 401
      throw error
    }

    const accessToken = await getAccessToken(refreshToken)
    const query = new URLSearchParams({
      pageSize: "100",
      readMask: "name,title,storefrontAddress,websiteUri,metadata",
    })

    const data = await googleBusinessRequest(
      accessToken,
      `/v1/accounts/-/locations?${query.toString()}`,
      {},
      "businessInformation",
    )

    const locations = data.locations || []
    const matches = locations.filter((location) =>
      /homeshield/i.test(String(location.title || "")) ||
      /homeshield\.ltd/i.test(String(location.websiteUri || "")),
    )

    const selected = matches.length === 1 ? matches[0] : matches[0] || null
    if (!selected?.name) {
      const available = locations.map((location) => ({
        locationName: location.name,
        accountId: String(location.name || "").match(/^accounts\/([^/]+)/)?.[1] || null,
        locationId: String(location.name || "").match(/\/locations\/([^/]+)$/)?.[1] || null,
        businessName: location.title || null,
        websiteUrl: location.websiteUri || null,
        address: location.storefrontAddress || null,
      }))
      const error = new Error("No Homeshield Google Business Profile location could be identified automatically.")
      error.status = 422
      error.code = "GOOGLE_REVIEW_LOCATION_SELECTION_REQUIRED"
      error.locations = available
      throw error
    }

    let accountId = null
    let locationId = null
    let locationName = String(selected.name || "")

    const fullMatch = locationName.match(/^accounts\/([^/]+)\/locations\/([^/]+)$/)
    const locationOnlyMatch = locationName.match(/^locations\/([^/]+)$/)

    if (fullMatch) {
      accountId = fullMatch[1]
      locationId = fullMatch[2]
    } else if (locationOnlyMatch) {
      locationId = locationOnlyMatch[1]

      // Google can return locations/{locationId} from the wildcard location
      // listing. The Reviews API still requires the owning account ID.
      const accountsData = await googleBusinessRequest(
        accessToken,
        "/v1/accounts",
        {},
        "accountManagement",
      )

      for (const account of accountsData.accounts || []) {
        const candidateAccountId = String(account?.name || "").match(/^accounts\/([^/]+)$/)?.[1]
        if (!candidateAccountId) continue

        const accountQuery = new URLSearchParams({
          pageSize: "100",
          readMask: "name,title,storefrontAddress,websiteUri,metadata",
        })

        const accountLocations = await googleBusinessRequest(
          accessToken,
          `/v1/accounts/${encodeURIComponent(candidateAccountId)}/locations?${accountQuery.toString()}`,
          {},
          "businessInformation",
        )

        const matchingLocation = (accountLocations.locations || []).find((location) => {
          const name = String(location?.name || "")
          return name === locationName ||
            name === `accounts/${candidateAccountId}/locations/${locationId}` ||
            name.endsWith(`/locations/${locationId}`)
        })

        if (matchingLocation) {
          accountId = candidateAccountId
          locationName = String(matchingLocation.name || `accounts/${candidateAccountId}/locations/${locationId}`)
          break
        }
      }
    }

    if (!accountId || !locationId) {
      throw new Error(`Unable to resolve the Google Business Profile account for location ${locationName}`)
    }

    const result = {
      status: "success",
      accountId,
      locationId,
      accountName: `accounts/${accountId}`,
      locationName: `accounts/${accountId}/locations/${locationId}`,
      businessName: selected.title || null,
      websiteUrl: selected.websiteUri || null,
      address: selected.storefrontAddress || null,
    }

    await saveLocation(result)

    if (log?.id) {
      await updateIntegrationLog(log.id, {
        status: "success",
        http_status: 200,
        external_id: selected.name,
        result,
      })
    }

    return res.status(200).json(result)
  } catch (error) {
    const result = {
      status: "failed",
      code: error?.code || null,
      error: error instanceof Error ? error.message : String(error),
      locations: error?.locations || undefined,
    }

    try {
      if (log?.id) {
        await updateIntegrationLog(log.id, {
          status: "failed",
          http_status: error?.status || 500,
          error_message: result.error,
          result,
        })
      }
    } catch (logError) {
      console.error("Unable to record Google location discovery failure:", logError)
    }

    return res.status(error?.status >= 400 && error.status < 600 ? error.status : 502).json(result)
  }
}
