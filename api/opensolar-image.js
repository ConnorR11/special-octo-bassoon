export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" })
  }

  const rawUrl = String(req.query?.url || "").trim()
  if (!rawUrl) {
    return res.status(400).json({ success: false, error: "OpenSolar image URL is required." })
  }

  let imageUrl
  try {
    imageUrl = new URL(rawUrl)
  } catch {
    return res.status(400).json({ success: false, error: "Invalid OpenSolar image URL." })
  }

  if (imageUrl.hostname !== "api.opensolar.com") {
    return res.status(400).json({ success: false, error: "Only OpenSolar image URLs are supported." })
  }

  try {
    // The image URL stored in appointments.open_solar_image is already a
    // signed OpenSolar URL, so try it directly first. This is important
    // because the signature is the authorisation for the image endpoint.
    let response = await fetch(imageUrl.toString(), {
      headers: { Accept: "image/*" },
      redirect: "follow",
    })

    // Some OpenSolar endpoints require the API token instead. Retry with
    // the configured token only when the signed request is rejected.
    if (!response.ok && (response.status === 401 || response.status === 403)) {
      const token = String(process.env.OPENSOLAR_API_TOKEN || "").trim()
      if (token) {
        response = await fetch(imageUrl.toString(), {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "image/*",
          },
          redirect: "follow",
        })
      }
    }

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: `OpenSolar image request returned HTTP ${response.status}.`,
      })
    }

    const contentType = response.headers.get("content-type") || "image/png"
    const buffer = Buffer.from(await response.arrayBuffer())

    res.setHeader("Content-Type", contentType)
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600")
    return res.status(200).send(buffer)
  } catch (error) {
    console.error("OpenSolar image proxy failed", error)
    return res.status(500).json({
      success: false,
      error: error?.message || "Unable to retrieve the OpenSolar image.",
    })
  }
}
