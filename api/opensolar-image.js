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
    // The URL comes directly from appointments.open_solar_image and is
    // already signed by OpenSolar. Do not use the OpenSolar API token.
    const response = await fetch(imageUrl.toString(), {
      headers: { Accept: "image/*" },
      redirect: "follow",
    })

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
