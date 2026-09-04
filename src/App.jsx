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
import Contracts from "./pages/Contracts"
import CustomerDetail from "./pages/CustomerDetail"
import Appointments from "./pages/Appointments"
import AppointmentDetail from "./pages/AppointmentDetail"


function App() {

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
   * INITIAL LOAD
   * =========================================================
   */

  useEffect(() => {
    loadContracts()
  }, [])


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
   *
   * This is called by the Appointments page
   * when a row is clicked.
   * =========================================================
   */

  function handleAppointmentSelect(
    appointment
  ) {

    console.log(
      "Opening appointment:",
      appointment
    )

    /*
     * Make absolutely sure a deal isn't
     * still selected.
     */

    setSelected(null)

    /*
     * Store the complete appointment record.
     */

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
   * RENDER
   * =========================================================
   */

  return (

    <div className="app">

      {/* =====================================================
          SIDEBAR
          ===================================================== */}

      <Sidebar
        page={page}
        setPage={
          handlePageChange
        }
        mobile={mobile}
        setMobile={setMobile}
      />


      <main>

        {/* =================================================
            HEADER
            ================================================= */}

        <Header
          page={headerPage}
          setMobile={setMobile}
          onRefresh={
            loadContracts
          }
        />


        {/* =================================================
            DATABASE ERROR
            ================================================= */}

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


        {/* =================================================
            APPOINTMENT DETAIL
            =================================================
            
            IMPORTANT:
            This is checked BEFORE the normal page routing.
            
            Therefore:
            
            selectedAppointment
                    ↓
            AppointmentDetail
            
            rather than going back to Appointments.
            ================================================= */}

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

          /* =================================================
             CUSTOMER / DEAL DETAIL
             ================================================= */

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

          /* =================================================
             DASHBOARD
             ================================================= */

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
          "contracts" ? (

          /* =================================================
             DEALS
             ================================================= */

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

          /* =================================================
             APPOINTMENTS
             ================================================= */

          <Appointments
            onSelectAppointment={
              handleAppointmentSelect
            }
          />

        ) : page ===
          "fitsheet" ? (

          /* =================================================
             FIT SHEET
             ================================================= */

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

          /* =================================================
             EPVS
             ================================================= */

          <EPVSCalculator />

        )}

      </main>

    </div>
  )
}

export default App