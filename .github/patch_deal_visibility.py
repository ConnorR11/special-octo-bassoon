from pathlib import Path

p = Path('src/App.jsx')
s = p.read_text()

old = '''    let request = supabase.from("deals").select("*").order("sale_date", { ascending: false }).range(from, to)
    if (search) { const escaped = search.replace(/[%_]/g, "\\\\$&").replace(/,/g, "\\\\,"); request = request.or(`customer_name.ilike.%${escaped}%,postcode.ilike.%${escaped}%,phone.ilike.%${escaped}%,contract_number.ilike.%${escaped}%`) }
    if (statusValue && statusValue !== "all") request = request.eq("status", statusValue)'''

new = '''    let request = supabase.from("deals").select("*").order("sale_date", { ascending: false }).range(from, to)

    // Sales reps can see their own deals plus deals belonging to reps they manage
    // (sales manager, manager, or branch manager). Permission 3+ retains full visibility.
    if (effectivePermissionLevel < 3) {
      const viewerId = previewUser?.id || profile?.id
      let visibleSalespersonIds = []

      if (viewerId) {
        const { data: visibleProfiles, error: visibleProfilesError } = await supabase
          .from("profiles")
          .select("pipedrive_person_id")
          .or(`id.eq.${viewerId},sales_manager.eq.${viewerId},manager_id.eq.${viewerId},branch_manager.eq.${viewerId}`)

        if (visibleProfilesError) throw visibleProfilesError
        visibleSalespersonIds = (visibleProfiles || [])
          .map(row => String(row?.pipedrive_person_id || "").trim())
          .filter(Boolean)
      }

      if (visibleSalespersonIds.length) request = request.in("salesperson", visibleSalespersonIds)
      else request = request.eq("salesperson", "__NO_VISIBLE_SALESPERSON__")
    }

    if (search) { const escaped = search.replace(/[%_]/g, "\\\\$&").replace(/,/g, "\\\\,"); request = request.or(`customer_name.ilike.%${escaped}%,postcode.ilike.%${escaped}%,phone.ilike.%${escaped}%,contract_number.ilike.%${escaped}%`) }
    if (statusValue && statusValue !== "all") request = request.eq("status", statusValue)'''

if old not in s:
    raise SystemExit('Target loadContracts block not found; no changes made.')

p.write_text(s.replace(old, new, 1))
