import React, { useEffect, useMemo, useState } from "react"
import { supabase } from "./lib/supabase"
import EPVSCalculator from "./EPVSCalculator"
import Sidebar from "./components/Sidebar"
import Header from "./components/Header"
import ContractDrawer from "./components/ContractDrawer"
import Dashboard from "./pages/Dashboard"
import Contracts from "./pages/Contracts"

function App() {
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [page, setPage] = useState("dashboard")
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [selected, setSelected] = useState(null)
  const [mobile, setMobile] = useState(false)

  async function loadContracts() {
    setLoading(true)
    setError("")

    if (!supabase) {
      setError(
        "Supabase is not configured. Check your environment variables."
      )
      setLoading(false)
      return
    }

    const { data, error: supabaseError } = await supabase
      .from("sold_contracts")
      .select("*")
      .order("sale_date", { ascending: false })

    if (supabaseError) {
      setError(supabaseError.message)
      setContracts([])
    } else {
      setContracts(data || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadContracts()
  }, [])

  const filteredContracts = useMemo(() => {
    const search = query.toLowerCase().trim()

    return contracts.filter((contract) => {
      const searchableFields = [
        contract.customer_name,
        contract.postcode,
        contract.product,
        contract.salesperson,
        contract.contract_number,
        contract.phone,
        contract.email,
      ]

      const matchesSearch =
        !search ||
        searchableFields.some((field) =>
          String(field || "").toLowerCase().includes(search)
        )

      const matchesStatus =
        status === "all" || contract.status === status

      return matchesSearch && matchesStatus
    })
  }, [contracts, query, status])

  const totalValue = contracts.reduce(
    (total, contract) => total + Number(contract.deal_value || 0),
    0
  )

  const averageValue =
    contracts.length > 0 ? totalValue / contracts.length : 0

  const today = new Date().toISOString().slice(0, 10)

  const upcomingInstallations = contracts.filter(
    (contract) =>
      contract.installation_date &&
      contract.installation_date >= today
  ).length

  return (
    <div className="app">
      <Sidebar
        page={page}
        setPage={setPage}
        mobile={mobile}
        setMobile={setMobile}
      />

      <main>
        <Header
          page={page}
          setMobile={setMobile}
          onRefresh={loadContracts}
        />

        {error && page !== "epvs" && (
          <div className="error">
            <b>Database error</b>
            <span>{error}</span>
          </div>
        )}

        {page === "dashboard" ? (
          <Dashboard
            contracts={contracts}
            total={totalValue}
            avg={averageValue}
            upcoming={upcomingInstallations}
            loading={loading}
            setPage={setPage}
            setSelected={setSelected}
          />
        ) : page === "contracts" ? (
          <Contracts
            filtered={filteredContracts}
            loading={loading}
            query={query}
            setQuery={setQuery}
            status={status}
            setStatus={setStatus}
            setSelected={setSelected}
          />
        ) : (
          <EPVSCalculator />
        )}
      </main>

      {selected && (
        <ContractDrawer
          contract={selected}
          close={() => setSelected(null)}
        />
      )}
    </div>
  )
}

export default App
