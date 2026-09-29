import React from "react"

import FitSheet from "../FitSheet"
import SalesPerformance from "./SalesPerformance"

function Dashboard(props) {
  const path = window.location.pathname.replace(/\/+$/, "") || "/"

  // The existing sidebar uses /fitsheet. Keep that route working while
  // FitSheet remains a single implementation in src/FitSheet.jsx.
  if (path === "/fitsheet" || path === "/fit-sheet") {
    return <FitSheet setSelected={props?.setSelected} />
  }

  return <SalesPerformance {...props} />
}

export default Dashboard
