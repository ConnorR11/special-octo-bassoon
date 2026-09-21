from pathlib import Path
import subprocess

p = Path('src/components/AppointmentActions.jsx')
s = p.read_text()

if 'SalesPresenter from "./SalesPresenter"' not in s:
    s = s.replace('import RepConfirmation from "./RepConfirmation"\n', 'import RepConfirmation from "./RepConfirmation"\nimport SalesPresenter from "./SalesPresenter"\n', 1)

if '  Presentation,\n' not in s:
    s = s.replace('  FileDown,\n', '  FileDown,\n  Presentation,\n', 1)

if 'showSalesPresenter' not in s:
    s = s.replace('  const [open, setOpen] =\n    useState(false)\n', '  const [open, setOpen] =\n    useState(false)\n\n  const [showSalesPresenter, setShowSalesPresenter] =\n    useState(false)\n', 1)

    marker = '  const setField = (\n    field,\n    value\n  ) =>'
    handler = '''  async function openSalesPresenter() {
    const presentationType = solarAppointment ? "solar" : "windows"
    setOpen(false)

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      const triggeredBy = getSubmittedBy(userData?.user)
      const { data: presentation, error: presentationError } = await supabase
        .from("sales_presentations")
        .select("id,name,presentation_type")
        .eq("presentation_type", presentationType)
        .eq("active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle()
      if (presentationError) throw presentationError

      const now = new Date().toISOString()
      const { error: actionError } = await supabase.from("action_runs").insert({
        action_type: "sales_presenter",
        status: "completed",
        entity_type: "appointment",
        entity_id: appointment?.appointment_row_id,
        triggered_by: triggeredBy,
        started_at: now,
        completed_at: now,
        input_data: {
          presentation_type: presentationType,
          presentation_id: presentation?.id || null,
          presentation_name: presentation?.name || null,
        },
        output_data: { launched: true, presentation_type: presentationType },
      })
      if (actionError) throw actionError
    } catch (err) {
      console.error("Sales Presenter action failed:", err)
    }

    setShowSalesPresenter(true)
  }

'''
    if marker not in s:
        raise SystemExit('setField marker not found')
    s = s.replace(marker, handler + marker, 1)

    result_marker = '''              <MenuButton
                icon={Plus}
                onClick={() =>
                  closeAnd(
                    onResultLegacy
                  )
                }
              >
                Result Appointment
              </MenuButton>
'''
    if result_marker not in s:
        raise SystemExit('result action marker not found')
    s = s.replace(result_marker, result_marker + '''
              <MenuButton
                icon={Presentation}
                onClick={openSalesPresenter}
              >
                Sales Presenter
              </MenuButton>
''', 1)

    render_marker = '      {showEdit && (\n'
    if render_marker not in s:
        raise SystemExit('render marker not found')
    s = s.replace(render_marker, '''      {showSalesPresenter && (
        <SalesPresenter
          appointment={appointment}
          onClose={() => setShowSalesPresenter(false)}
        />
      )}

''' + render_marker, 1)

    p.write_text(s)

subprocess.run(['git', 'config', 'user.name', 'github-actions[bot]'], check=True)
subprocess.run(['git', 'config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'], check=True)
subprocess.run(['git', 'add', 'src/components/AppointmentActions.jsx'], check=True)
subprocess.run(['git', 'commit', '-m', 'Integrate sales presenter appointment action'], check=True)
subprocess.run(['git', 'push'], check=True)

Path('.github/patch-sales-presenter.py').unlink()
Path('.github/workflows/apply-sales-presenter-integration.yml').unlink()
subprocess.run(['git', 'add', '-u', '.github'], check=True)
subprocess.run(['git', 'commit', '-m', 'Remove temporary presenter integration patch'], check=True)
subprocess.run(['git', 'push'], check=True)
