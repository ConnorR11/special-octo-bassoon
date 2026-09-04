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
   * Kept separate from selected deal.
   * This will allow us to build AppointmentDetail
   * independently from CustomerDetail.
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
   * CHANGE PAGE
   *
   * Clear both selected records whenever
   * the user navigates somewhere else.
   * =========================================================
   */

  function handlePageChange(
    newPage
  ) {
    setSelected(null)

    setSelectedAppointment(
      null
    )

    setPage(newPage)
  }


  /*
   * =========================================================
   * SELECT APPOINTMENT
   *
   * For now this stores the appointment.
   *
   * Next we can create:
   *
   * AppointmentDetail.jsx
   *
   * and render it here.
   * =========================================================
   */

  function handleAppointmentSelect(
    appointment
  ) {
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
    setSelectedAppointment(
      null
    )

    setPage(
      "appointments"
    )
  }


  /*
   * =========================================================
   * HEADER PAGE NAME
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
            CUSTOMER DETAIL
            ================================================= */}

        {selected ? (

          <CustomerDetail
            deal={selected}
            onBack={
              handleBackToDeals
            }
            onUpdated={
              handleDealUpdated
            }
          />

        ) : selectedAppointment ? (

          /*
           * =================================================
           * APPOINTMENT DETAIL
           *
           * TEMPORARY PLACEHOLDER
           *
           * Once we create AppointmentDetail.jsx,
           * this is the only section we need to replace.
           * =================================================
           */

          <section>

            <div
              className="card"
              style={{
                padding:
                  "30px",
              }}
            >

              <button
                type="button"
                onClick={
                  handleBackToAppointments
                }
                style={{
                  border: 0,
                  background:
                    "transparent",
                  cursor:
                    "pointer",
                  padding: 0,
                  marginBottom:
                    "20px",
                  fontSize:
                    "11px",
                  color:
                    "#172554",
                }}
              >
                ← Back to appointments
              </button>


              <h1
                style={{
                  margin: 0,
                  fontSize:
                    "24px",
                }}
              >
                {selectedAppointment.customer_name ||
                  "Appointment"}
              </h1>


              <p
                style={{
                  fontSize:
                    "12px",
                  color:
                    "#888",
                }}
              >
                Appointment detail view
              </p>


              <div
                style={{
                  marginTop:
                    "20px",
                  padding:
                    "15px",
                  background:
                    "#f7f7f8",
                  borderRadius:
                    "7px",
                  fontSize:
                    "11px",
                  color:
                    "#555",
                }}
              >

                <strong>
                  Appointment ID:
                </strong>{" "}

                {selectedAppointment.id ||
                  "—"}

              </div>

            </div>

          </section>

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