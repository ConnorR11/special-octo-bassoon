import { Search } from "lucide-react"
import { formatDate, getInitials, money, statusLabel } from "../utils/formatters"
import { supabase } from "../lib/supabase"

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

    try {
      const pageSize = 1000
      let allContracts = []
      let from = 0

      while (true) {
        const to = from + pageSize - 1

        const {
          data,
          error: supabaseError,
        } = await supabase
          .from("deals")
          .select("*")
          .order("sale_date", {
            ascending: false,
          })
          .range(from, to)

        if (supabaseError) {
          throw supabaseError
        }

        if (!data || data.length === 0) {
          break
        }

        allContracts = [
          ...allContracts,
          ...data,
        ]

        if (data.length < pageSize) {
          break
        }

        from += pageSize
      }

      setContracts(allContracts)
    } catch (err) {
      console.error("Error loading contracts:", err)

      setError(
        err?.message ||
          "Unable to load contracts from Supabase."
      )

      setContracts([])
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
          String(field || "")
            .toLowerCase()
            .includes(search)
        )

      const matchesStatus =
        status === "all" ||
        contract.status === status

      return (
        matchesSearch &&
        matchesStatus
      )
    })
  }, [contracts, query, status])

  /*
   * TOTAL CONTRACT VALUE
   *
   * This now uses ALL contracts loaded from Supabase,
   * rather than only the first 1,000.
   */

  const totalValue = contracts.reduce(
    (total, contract) =>
      total +
      Number(contract.deal_value || 0),
    0
  )

  /*
   * AVERAGE CONTRACT VALUE
   */

  const averageValue =
    contracts.length > 0
      ? totalValue / contracts.length
      : 0

  /*
   * TODAY
   */

  const today = new Date()
    .toISOString()
    .slice(0, 10)

  /*
   * UPCOMING INSTALLATIONS
   */

  const upcomingInstallations =
    contracts.filter(
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

            <span>
              {error}
            </span>
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
          close={() =>
            setSelected(null)
          }
        />
      )}

    </div>
  )
}

export default App