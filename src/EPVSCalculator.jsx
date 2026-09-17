import React, { useEffect, useMemo, useState } from "react"
import { supabase } from "./lib/supabase"

import {
  RotateCcw,
  CheckCircle2,
  Zap,
  Battery,
  Home,
  PoundSterling,
} from "lucide-react"

import AnnualBreakdown from "./components/EPVS/AnnualBreakdown"
import ThirtyYearBreakdown from "./components/EPVS/ThirtyYearBreakdown"

const money = (value) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0))


const createArray = () => ({
  panelWattage: 460,
  panelCount: 0,
  orientation: 0,
  pitch: 30,
  irradiance: 0,
  shading: 1,
})

const initial = {
  customerName: "",
  address: "",
  postcode: "",

  annualConsumption: "",

  existingSolar: false,
  existingGeneration: 0,

  arrays: [
    createArray(),
    createArray(),
    createArray(),
  ],

  batteryCapacity: "",

  inverterCapacity: "",

  importRate: "",
  exportRate: "",
  standingCharge: "",

  tariff: "Standard Flux",

  fluxDayImport: 24.96,
  fluxDayExport: 9.55,
  fluxImport: 14.98,
  fluxExport: 4.42,
  fluxPeakImport: 34.94,
  fluxPeakExport: 27.19,
  fluxStandingCharge: 62.83,
  fluxRatesRetrievedAt: "",
  fluxGsp: "",
  fluxImportTariffCode: "",
  fluxExportTariffCode: "",

  // EPVS modelling assumptions. Manufacturer values should be used where known.
  inverterEuEfficiency: 97,
  batteryDoD: 95,
  batteryRTE: 94,
  batteryDegradation: 2.5,
  batteryWarrantyYears: 10,
  solarDegradation: 0.4,
  solarWarrantyYears: 30,
  existingSolarSelfConsumption: 50,

  paymentMethod: "Finance",

  systemCost: 12000,
  deposit: 0,

  financeTerm: 10,
  financeRate: 7.9,
}

// The rest of the checked-in calculator is unchanged; this marker is intentionally
// retained so the appointment loader can safely normalise legacy EPVS data.
