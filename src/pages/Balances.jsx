import React, { useEffect, useMemo, useState } from "react"
import { AlertCircle, CalendarDays, ChevronRight, FileText, MapPin, PoundSterling, Search } from "lucide-react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { supabase } from "../lib/supabase"
import { formatDate, getInitials, money } from "../utils/formatters"

const PAGE_SIZE = 1000

function toNumber(value) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

export default function Balances({ onSelect }) {
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")

  useEffect(() => {
    let cancelled = false

    async function loadBalances() {
      if (!supabase) {
        setError("Supabase is not configured.")
        setLoading(false)
        return
      }

      setLoading(true)
      setError("")

      try {
        const results = []
        let from = 0

        while (true) {
          const { data, error: supabaseError } = await supabase
            .from("deals")
            .select("*")
            .gt("balance_outstanding", 0)
            .order("estimated_payment_date", { ascending: true, nullsFirst: false })
            .range(from, from + PAGE_SIZE - 1)

          if (supabaseError) throw supabaseError

          const batch = data || []
          results.push(...batch)

          if (batch.length < PAGE_SIZE) break
          from += PAGE_SIZE
        }

        if (!cancelled) setDeals(results)
      } catch (err) {
        console.error("Error loading outstanding balances:", err)
        if (!cancelled) {
          setDeals([])
          setError(err?.message || "Unable to load outstanding balances.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadBalances()
    return () => { cancelled = true }
  }, [])

  const filteredDeals = useMemo(() => {
    const value = search.trim().toLowerCase()
    if (!value) return deals

    return deals.filter((deal) =>
      [
        deal?.customer_name,
        deal?.contract_number,
        deal?.postcode,
        deal?.phone,
        deal?.product,
        deal?.salesperson,
        deal?.pipedrive_stage,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(value)
    )
  }, [deals, search])

  const totalOutstanding = filteredDeals.reduce(
    (total, deal) => total + toNumber(deal?.balance_outstanding),
    0
  )

  const paymentChartData = useMemo(() => {
    const today = new Date()
    const todayKey = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-")

    let outstanding = 0
    const futureByDay = new Map()

    deals.forEach((deal) => {
      const rawDate = String(deal?.estimated_payment_date || "").trim()
      const match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/)
      const amount = toNumber(deal?.balance_outstanding)

      if (!match) return

      const dateKey = `${match[1]}-${match[2]}-${match[3]}`

      if (dateKey < todayKey) {
        outstanding += amount
        return
      }

      futureByDay.set(dateKey, (futureByDay.get(dateKey) || 0) + amount)
    })

    const data = []

    if (outstanding > 0) {
      data.push({
        dateKey: "outstanding",
        date: "Outstanding",
        amount: outstanding,
      })
    }

    Array.from(futureByDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([dateKey, amount]) => {
        const [year, month, day] = dateKey.split("-")
        const date = new Date(Number(year), Number(month) - 1, Number(day))

        data.push({
          dateKey,
          date: new Intl.DateTimeFormat("en-GB", {
            day: "2-digit",
            month: "short",
          }).format(date),
          amount,
        })
      })

    return data
  }, [deals])

  return (
    <section>
      <div
        className="card"
        style={{
          marginBottom: 18,
          padding: "18px 20px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: "#7b8790",
                textTransform: "uppercase",
                letterSpacing: ".05em",
              }}
            >
              Outstanding balances
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 22,
                fontWeight: 800,
                color: "#263645",
              }}
            >
              {money(totalOutstanding)}
            </div>
            <div
              style={{
                marginTop: 3,
                fontSize: 10,
                color: "#8a959d",
              }}
            >
              {filteredDeals.length} {filteredDeals.length === 1 ? "job" : "jobs"} outstanding
            </div>
          </div>

          <div style={{ position: "relative", width: "min(420px, 100%)" }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
                pointerEvents: "none",
              }}
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customer, contract, postcode..."
              aria-label="Search outstanding balances"
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: "1px solid #d7dee8",
                borderRadius: 8,
                padding: "10px 12px 10px 36px",
                fontSize: 12,
                outline: "none",
                background: "#fff",
              }}
            />
          </div>
        </div>
      </div>

      {paymentChartData.length > 0 && (
        <div
          className="card"
          style={{
            marginBottom: 18,
            padding: "18px 20px 14px",
          }}
        >
          <div style={{ marginBottom: 10 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "#263645",
              }}
            >
              Expected payments
            </div>
            <div
              style={{
                marginTop: 3,
                fontSize: 10,
                color: "#8a959d",
              }}
            >
              Outstanding balance grouped by estimated payment month
            </div>
          </div>

          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={paymentChartData}
                margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
              >
                <CartesianGrid stroke="#eef1f3" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: "#7b8790" }}
                  axisLine={{ stroke: "#dfe5ea" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#7b8790" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `£${Math.round(value / 1000)}k`}
                  width={48}
                />
                <Tooltip
                  formatter={(value) => [money(value), "Outstanding"]}
                  contentStyle={{
                    border: "1px solid #dfe5ea",
                    borderRadius: 8,
                    fontSize: 11,
                    boxShadow: "0 4px 12px rgba(15,23,42,.08)",
                  }}
                  labelStyle={{
                    color: "#263645",
                    fontWeight: 700,
                  }}
                />
                <Bar
                  dataKey="amount"
                  name="Outstanding"
                  fill="#7e22ce"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={54}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {error ? (
        <div
          className="card"
          style={{
            padding: 28,
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "#b42318",
            fontSize: 12,
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      ) : loading ? (
        <div
          className="card"
          style={{
            padding: 60,
            textAlign: "center",
            color: "#8a959d",
            fontSize: 12,
          }}
        >
          Loading outstanding balances...
        </div>
      ) : !filteredDeals.length ? (
        <div
          className="card"
          style={{
            padding: 60,
            textAlign: "center",
            color: "#8a959d",
            fontSize: 12,
          }}
        >
          <PoundSterling size={30} style={{ marginBottom: 8 }} />
          <div style={{ fontWeight: 700, color: "#56636d" }}>
            {search ? "No matching balances found" : "No outstanding balances"}
          </div>
        </div>
      ) : (
        <div
          className="card"
          style={{
            padding: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1.15fr 1.2fr 1.1fr 1.1fr 1fr 30px",
              gap: 12,
              alignItems: "center",
              padding: "10px 14px",
              background: "#f7f9fb",
              borderBottom: "1px solid #e1e6eb",
              color: "#687782",
              fontSize: 9,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: ".04em",
            }}
          >
            <div>Customer</div>
            <div>Contract</div>
            <div>Product</div>
            <div>Stage</div>
            <div>Estimated Payment Date</div>
            <div style={{ textAlign: "right" }}>Outstanding</div>
            <div />
          </div>

          {filteredDeals.map((deal) => (
            <button
              key={deal?.id || deal?.pipedrive_deal_id || deal?.contract_number}
              type="button"
              onClick={() => onSelect?.(deal)}
              style={{
                width: "100%",
                display: "grid",
                gridTemplateColumns: "2fr 1.15fr 1.2fr 1.1fr 1.1fr 1fr 30px",
                gap: 12,
                alignItems: "center",
                padding: "12px 14px",
                border: 0,
                borderBottom: "1px solid #eef1f3",
                background: "#fff",
                textAlign: "left",
                cursor: onSelect ? "pointer" : "default",
                fontFamily: "inherit",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "0 0 auto",
                    background: "#f3e8ff",
                    color: "#7e22ce",
                    fontSize: 9,
                    fontWeight: 800,
                  }}
                >
                  {getInitials(deal?.customer_name || "Customer")}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#263645",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {deal?.customer_name || "Unnamed customer"}
                  </div>
                  <div
                    style={{
                      marginTop: 3,
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 9,
                      color: "#8a959d",
                    }}
                  >
                    <MapPin size={11} />
                    <span>{deal?.postcode || "No postcode"}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#53616b", fontSize: 10, minWidth: 0 }}>
                <FileText size={13} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {deal?.contract_number || "—"}
                </span>
              </div>

              <div style={{ fontSize: 10, color: "#53616b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {deal?.product || "—"}
              </div>

              <div style={{ fontSize: 10, color: "#53616b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {deal?.pipedrive_stage || "—"}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#53616b", fontSize: 10 }}>
                <CalendarDays size={13} />
                <span>{deal?.estimated_payment_date ? formatDate(deal.estimated_payment_date) : "—"}</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5, color: "#9f1239", fontSize: 11 }}>
                <PoundSterling size={13} />
                <strong>{money(toNumber(deal?.balance_outstanding))}</strong>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", color: "#9aa5ad" }}>
                <ChevronRight size={17} />
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
