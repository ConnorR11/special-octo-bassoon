import React, {
  useEffect,
  useMemo,
  useState,
} from "react"

import { supabase } from "./lib/supabase"

import EPVSCalculator from "./EPVSCalculator"

import Sidebar from "./components/Sidebar"
import Header from "./components/Header"
import FitSheet from "./components/FitSheet"

import Dashboard from "./pages/Dashboard"
import MarketingDashboard from "./pages/MarketingDashboard"
import Contracts from "./pages/Contracts"
import CustomerDetail from "./pages/CustomerDetail"
import Appointments from "./pages/Appointments"
import AppointmentDetail from "./pages/AppointmentDetail"
import Login from "./pages/Login"
import SalesKPI from "./pages/SalesKPI"


function App() {

  /*
   * =========================================================
   * AUTHENTICATION
   * =========================================================
   */

  const [session, setSession] =
    useState(null)

  const [authLoading, setAuthLoading] =
    useState(true)


  /*
   * =========================================================
   * AUTH INITIALISATION
   * =========================================================
   */

  useEffect(() => {

    if (!supabase) {
      setAuthLoading(false)
      return
    }

    let mounted = true

    async function loadSession() {

      const {
        data,
        error: sessionError,
      } = await supabase.auth.getSession()

      if (!mounted) {
        return
      }

      if (sessionError) {
        console.error(
          "Error loading auth session:",
          sessionError
        )

        setSession(null)

      } else {

        setSession(
          data?.session || null
        )
      }

      setAuthLoading(false)
    }

    loadSession()

    const {
      data: authListener,
    } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {

        if (!mounted) {
          return
        }

        setSession(
          nextSession || null
        )
      }
    )

    return () => {

      mounted = false

      authListener?.subscription?.unsubscribe()
    }

  }, [])


  /*
   * =========================================================
   * LOAD DEALS
   * =========================================================
   */

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

    const {
      data,
      error: supabaseError,
    } = await supabase
      .from("deals")
      .select("*")
      .order("sale_date", {
        ascending: false,
      })

    if (supabaseError) {

      setError(
        supabaseError.message
      )

      setContracts([])

    } else {

      setContracts(
        data || []
      )
    }

    setLoading(false)
  }


  /*
   * =========================================================
   * DEALS
   * =========================================================
   */

  const [contracts, setContracts] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState("")


  /*
   * =========================================================
   * NAVIGATION
   * =========================================================
   */

  const [page, setPage] =
    useState("dashboard")

  const [mobile, setMobile] =
    useState(false)


  /*
   * =========================================================
   * DEAL SEARCH / FILTERS
   * =========================================================
   */

  const [query, setQuery] =
    useState("")

  const [status, setStatus] =
    useState("all")


  /*
   * =========================================================
   * SELECTED DEAL
   * =========================================================
   */

  const [selected, setSelected] =
    useState(null)


  /*
   * =========================================================
   * SELECTED APPOINTMENT
   *
   * This is kept completely separate from deals.
   * =========================================================
   */

  const [
    selectedAppointment,
    setSelectedAppointment,
  ] = useState(null)


  /*
   * =========================================================
   * INITIAL LOAD
   * =========================================================
   */

  useEffect(() => {

    if (!session) {
      return
    }

    loadContracts()

  }, [session])


  /*
   * =========================================================
   * FILTER DEALS
   * =========================================================
   */

  const filteredContracts =
    useMemo(() => {

      const search =
        query
          .toLowerCase()
          .trim()

      return contracts.filter(
        (contract) => {

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
            searchableFields.some(
              (field) =>
                String(
                  field || ""
                )
                  .toLowerCase()
                  .includes(search)
            )

          const matchesStatus =
            status === "all" ||
            contract.status ===
              status

          return (
            matchesSearch &&
            matchesStatus
          )
        }
      )

    }, [
      contracts,
      query,
      status,
    ])


  /*
   * =========================================================
   * DASHBOARD TOTALS
   * =========================================================
   */

  const totalValue =
    contracts.reduce(
      (
        total,
        contract
      ) =>
        total +
        Number(
          contract.deal_value ||
            0
        ),
      0
    )


  const averageValue =
    contracts.length > 0
      ? totalValue /
        contracts.length
      : 0


  /*
   * =========================================================
   * UPCOMING INSTALLATIONS
   * =========================================================
   */

  const today =
    new Date()
      .toISOString()
      .slice(0, 10)


  const upcomingInstallations =
    contracts.filter(
      (contract) =>
        contract.installation_date &&
        contract.installation_date >=
          today
    ).length


  /*
   * =========================================================
   * BACK TO DEALS
   * =========================================================
   */

  function handleBackToDeals() {

    setSelected(null)

    setPage(
      "contracts"
    )
  }


  /*
   * =========================================================
   * DEAL UPDATED
   * =========================================================
   */

  function handleDealUpdated(
    updatedDeal
  ) {

    setContracts(
      (current) =>
        current.map(
          (contract) =>
            contract.id ===
            updatedDeal.id
              ? updatedDeal
              : contract
        )
    )

    setSelected(
      updatedDeal
    )
  }


  /*
   * =========================================================
   * GENERAL PAGE NAVIGATION
   * =========================================================
   */

  function handlePageChange(
    newPage
  ) {

    /*
     * Whenever the user uses the sidebar,
     * close any open detail view.
     */

    setSelected(null)

    setSelectedAppointment(null)

    setPage(newPage)
  }


  /*
   * =========================================================
   * APPOINTMENT SELECT
   * =========================================================
   */

  function handleAppointmentSelect(
    appointment
  ) {

    console.log(
      "Opening appointment:",
      appointment
    )

    setSelected(null)

    setSelectedAppointment(
      appointment
    )
  }


  /*
   * =========================================================
   * BACK FROM APPOINTMENT
   * =========================================================
   */

  function handleBackToAppointments() {

    setSelectedAppointment(null)

    setPage(
      "appointments"
    )
  }


  /*
   * =========================================================
   * SIGN OUT
   * =========================================================
   */

  async function handleSignOut() {

    if (!supabase) {
      return
    }

    const {
      error: signOutError,
    } = await supabase.auth.signOut()

    if (signOutError) {
      console.error(
        "Error signing out:",
        signOutError
      )
    }
  }


  /*
   * =========================================================
   * HEADER PAGE
   * =========================================================
   */

  const headerPage =
    selected
      ? "customer"
      : selectedAppointment
        ? "appointment"
        : page


  /*
   * =========================================================
   * AUTH LOADING
   * =========================================================
   */

  if (authLoading) {

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f7fa",
          color: "#002d49",
          fontFamily: "Inter, Arial, sans-serif",
          fontSize: 14,
        }}
      >
        Loading CRM...
      </div>
    )
  }


  /*
   * =========================================================
   * LOGIN
   * =========================================================
   */

  if (!session) {

    return (
      <Login />
    )
  }


  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (

    <div className="app">

      <Sidebar
        page={page}
        setPage={
          handlePageChange
        }
        mobile={mobile}
        setMobile={setMobile}
      />


      <main>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 10,
            padding: "10px 24px 0",
            background: "#fff",
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: "#64748b",
            }}
          >
            {session?.user?.email || "Signed in"}
          </span>

          <button
            type="button"
            onClick={handleSignOut}
            style={{
              border: "1px solid #d7dce2",
              background: "#fff",
              color: "#002d49",
              borderRadius: 7,
              padding: "6px 10px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>

        <Header
          page={headerPage}
          setMobile={setMobile}
          onRefresh={
            loadContracts
          }
        />


        {error &&
          page !== "epvs" && (

            <div className="error">

              <b>
                Database error
              </b>

              <span>
                {error}
              </span>

            </div>
          )}


        {selectedAppointment ? (

          <AppointmentDetail
            appointment={
              selectedAppointment
            }
            onBack={
              handleBackToAppointments
            }
          />

        ) : selected ? (

          <CustomerDetail
            deal={selected}
            onBack={
              handleBackToDeals
            }
            onUpdated={
              handleDealUpdated
            }
          />

        ) : page ===
          "dashboard" ? (

          <Dashboard
            contracts={
              contracts
            }
            total={
              totalValue
            }
            avg={
              averageValue
            }
            upcoming={
              upcomingInstallations
            }
            loading={
              loading
            }
            setPage={
              handlePageChange
            }
            setSelected={
              setSelected
            }
          />

        ) : page ===
          "marketing-dashboard" ? (

          <MarketingDashboard
            contracts={contracts}
            loading={loading}
            onSelectAppointment={handleAppointmentSelect}
          />

        ) : page ===
          "sales-kpi" ? (

          <SalesKPI />

        ) : page ===
          "contracts" ? (

          <Contracts
            filtered={
              filteredContracts
            }
            loading={
              loading
            }
            query={
              query
            }
            setQuery={
              setQuery
            }
            status={
              status
            }
            setStatus={
              setStatus
            }
            setSelected={
              setSelected
            }
          />

        ) : page ===
          "appointments" ? (

          <Appointments
            onSelectAppointment={
              handleAppointmentSelect
            }
          />

        ) : page ===
          "fitsheet" ? (

          <FitSheet
            contracts={
              contracts
            }
            loading={
              loading
            }
            setSelected={
              setSelected
            }
            onSelectDeal={
              setSelected
            }
          />

        ) : (

          <EPVSCalculator />

        )}

      </main>

    </div>
  )
}

export default App
