import React, { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { supabase } from "../lib/supabase"
import DatabaseSalesPresenter from "./DatabaseSalesPresenter"
import DatabaseContractPreview from "./DatabaseContractPreview"

export default function SalesPresenter(props) {
  const [isContract, setIsContract] = useState(false)

  useEffect(() => {
    let mounted = true
    async function checkTemplate() {
      if (!props.templateId) { setIsContract(false); return }
      const { data } = await supabase.from("templates").select("name").eq("id", props.templateId).maybeSingle()
      if (mounted) setIsContract(data?.name === "Digital Solar Contract")
    }
    checkTemplate()
    return () => { mounted = false }
  }, [props.templateId])

  if (typeof document === "undefined") return null
  const Component = isContract ? DatabaseContractPreview : DatabaseSalesPresenter
  return createPortal(<Component {...props} />, document.body)
}
