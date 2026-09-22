import React from "react"
import { createPortal } from "react-dom"
import DatabaseSalesPresenter from "./DatabaseSalesPresenter"

export default function SalesPresenter(props) {
  if (typeof document === "undefined") return null
  return createPortal(<DatabaseSalesPresenter {...props} />, document.body)
}
