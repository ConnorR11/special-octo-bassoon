import React from "react"
import DataResults from "./DataResults"

export default function GlobalResults() {
  return <DataResults
    sourceFilter={["Global Windows", "Global Solar"]}
    reportTitle="Global"
  />
}
