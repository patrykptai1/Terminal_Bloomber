// ============================================================
// Fundamental & Financial Risk Assessment Engine
// Assesses: Financial health, earnings quality, macro exposure,
//           regulatory risk, balance sheet, debt service, dilution
// ============================================================

import type { QuoteData, KeyStatistics, EarningsData } from "./yahoo"

export interface RiskItem {
  category: "financial" | "fundamental" | "macro" | "regulatory" | "earnings"
  severity: "critical" | "high" | "medium" | "low"
  title: string
  description: string
  metric?: string      // e.g., "Debt/Equity: 250%"
  trend?: "improving" | "worsening" | "stable"
}

export interface RiskCategory {
  name: string
  icon: string
  score: number  // 1-10 (10 = highest risk)
  items: RiskItem[]
  summary: string
}

export interface FundamentalRiskReport {
  overallScore: number  // 1-100 (100 = safest)
  riskLevel: "Niskie" | "Umiarkowane" | "Podwyższone" | "Wysokie" | "Krytyczne"
  categories: RiskCategory[]
  topRisks: RiskItem[]  // Top 5 most critical
  positiveFactors: string[]
  verdict: string
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

export function computeFundamentalRisk(
  q: QuoteData,
  stats: KeyStatistics | null,
  earnings: EarningsData | null,
): FundamentalRiskReport {
  const allItems: RiskItem[] = []
  const positiveFactors: string[] = []

  // ══════════════════════════════════════════════════════════
  // 1. RYZYKO FINANSOWE — zadłużenie, płynność, obsługa długu
  // ══════════════════════════════════════════════════════════
  const financialItems: RiskItem[] = []
  let financialScore = 3 // base: moderate

  // Debt/Equity
  const de = stats?.debtToEquity
  if (de != null) {
    if (de > 200) {
      financialItems.push({ category: "financial", severity: "critical", title: "Ekstremalnie wysokie zadłużenie", description: `Wskaźnik Debt/Equity wynosi ${de.toFixed(0)}% — spółka jest mocno lewarowana. Obsługa długu może pochłaniać znaczną część zysku operacyjnego, szczególnie przy rosnących stopach procentowych.`, metric: `D/E: ${de.toFixed(0)}%` })
      financialScore += 3
    } else if (de > 100) {
      financialItems.push({ category: "financial", severity: "high", title: "Podwyższone zadłużenie", description: `Wskaźnik Debt/Equity na poziomie ${de.toFixed(0)}% — dźwignia finansowa powyżej normy. Ryzyko refinansowania w środowisku wysokich stóp.`, metric: `D/E: ${de.toFixed(0)}%` })
      financialScore += 2
    } else if (de < 30) {
      positiveFactors.push(`Niskie zadłużenie (D/E: ${de.toFixed(0)}%) — solidna pozycja bilansowa`)
      financialScore -= 1
    }
  }

  // Current Ratio
  const cr = stats?.currentRatio
  if (cr != null) {
    if (cr < 0.8) {
      financialItems.push({ category: "financial", severity: "critical", title: "Krytyczny brak płynności", description: `Current Ratio wynosi ${cr.toFixed(2)} — zobowiązania krótkoterminowe znacząco przewyższają aktywa obrotowe. Ryzyko niewypłacalności w krótkim terminie.`, metric: `CR: ${cr.toFixed(2)}` })
      financialScore += 3
    } else if (cr < 1.0) {
      financialItems.push({ category: "financial", severity: "high", title: "Niska płynność bieżąca", description: `Current Ratio poniżej 1.0 (${cr.toFixed(2)}) — spółka może mieć trudności z regulowaniem bieżących zobowiązań.`, metric: `CR: ${cr.toFixed(2)}` })
      financialScore += 2
    } else if (cr > 2.0) {
      positiveFactors.push(`Silna płynność (CR: ${cr.toFixed(2)}) — duży bufor bezpieczeństwa`)
    }
  }

  // Total Debt vs Cash
  const totalDebt = stats?.totalDebt
  const totalCash = stats?.totalCash
  if (totalDebt != null && totalCash != null) {
    const netDebt = totalDebt - totalCash
    if (netDebt > 0 && q.marketCap > 0) {
      const netDebtToMcap = (netDebt / q.marketCap) * 100
      if (netDebtToMcap > 50) {
        financialItems.push({ category: "financial", severity: "high", title: "Dług netto > 50% kapitalizacji", description: `Dług netto stanowi ${netDebtToMcap.toFixed(0)}% kapitalizacji rynkowej. Spółka jest mocno zadłużona w stosunku do swojej wartości rynkowej.`, metric: `Net Debt/MCap: ${netDebtToMcap.toFixed(0)}%` })
        financialScore += 2
      }
    } else if (netDebt < 0) {
      positiveFactors.push(`Pozycja gotówkowa netto — gotówka przewyższa dług`)
    }
  }

  // FCF
  const fcf = stats?.freeCashFlow
  if (fcf != null) {
    if (fcf < 0) {
      financialItems.push({ category: "financial", severity: "high", title: "Ujemny Free Cash Flow", description: `Spółka spala gotówkę (FCF: ${(fcf / 1e6).toFixed(0)}M). Wymaga zewnętrznego finansowania lub redukcji wydatków aby przetrwać.`, metric: `FCF: ${(fcf / 1e6).toFixed(0)}M`, trend: "worsening" })
      financialScore += 2
    } else if (fcf > 0 && q.marketCap > 0) {
      const fcfYield = (fcf / q.marketCap) * 100
      if (fcfYield > 5) positiveFactors.push(`Silny FCF Yield (${fcfYield.toFixed(1)}%) — spółka generuje dużo wolnej gotówki`)
    }
  }

  financialScore = clamp(financialScore, 1, 10)

  // ══════════════════════════════════════════════════════════
  // 2. RYZYKO EARNINGS — jakość zysków, SBC, rozmywanie, trendy
  // ══════════════════════════════════════════════════════════
  const earningsItems: RiskItem[] = []
  let earningsScore = 3

  if (earnings) {
    // EPS trend — are estimates being revised down?
    const fwd0y = earnings.forwardEstimates?.find(f => f.period === "0y")
    if (fwd0y) {
      const revisionsDown = fwd0y.epsRevisionsDown30d ?? 0
      const revisionsUp = fwd0y.epsRevisionsUp30d ?? 0
      if (revisionsDown > revisionsUp + 2) {
        earningsItems.push({ category: "earnings", severity: "high", title: "Analitycy obniżają prognozy", description: `W ostatnich 30 dniach ${revisionsDown} analityków obniżyło prognozę EPS vs ${revisionsUp} podwyższeń. Negatywny momentum estymacji.`, metric: `Rewizje: ${revisionsUp}↑ / ${revisionsDown}↓`, trend: "worsening" })
        earningsScore += 2
      } else if (revisionsUp > revisionsDown + 2) {
        positiveFactors.push(`Analitycy podnoszą prognozy (${revisionsUp}↑ vs ${revisionsDown}↓)`)
        earningsScore -= 1
      }

      // EPS trend direction
      if (fwd0y.epsTrendCurrent != null && fwd0y.epsTrend90d != null && fwd0y.epsTrend90d !== 0) {
        const drift = ((fwd0y.epsTrendCurrent - fwd0y.epsTrend90d) / Math.abs(fwd0y.epsTrend90d)) * 100
        if (drift < -10) {
          earningsItems.push({ category: "earnings", severity: "medium", title: "Spadający trend EPS", description: `Prognoza EPS spadła o ${Math.abs(drift).toFixed(0)}% w ciągu 90 dni. Rynek oczekuje gorszych wyników.`, trend: "worsening" })
          earningsScore += 1
        }
      }
    }

    // Beat/Miss rate
    const quarterly = earnings.quarterly ?? []
    if (quarterly.length >= 4) {
      const misses = quarterly.filter(q => q.surprise != null && q.surprise < 0).length
      if (misses >= 3) {
        earningsItems.push({ category: "earnings", severity: "high", title: "Seria chybionych wyników", description: `Spółka nie spełniła oczekiwań EPS w ${misses} z ${quarterly.length} ostatnich kwartałów. Słaba zdolność do realizacji prognoz.`, metric: `Miss rate: ${misses}/${quarterly.length}` })
        earningsScore += 2
      }
    }

    // Revenue growth deceleration
    const annualStmts = (earnings.annualStatements ?? []).filter(a => a.revenue != null)
    if (annualStmts.length >= 3) {
      const latest = annualStmts[annualStmts.length - 1]
      const prev = annualStmts[annualStmts.length - 2]
      const prev2 = annualStmts[annualStmts.length - 3]
      if (latest.revenue && prev.revenue && prev2.revenue) {
        const g1 = ((prev.revenue - prev2.revenue) / Math.abs(prev2.revenue)) * 100
        const g2 = ((latest.revenue - prev.revenue) / Math.abs(prev.revenue)) * 100
        if (g2 < g1 - 10 && g2 < 5) {
          earningsItems.push({ category: "earnings", severity: "medium", title: "Silne spowolnienie wzrostu", description: `Wzrost przychodów spadł z ${g1.toFixed(0)}% do ${g2.toFixed(0)}% YoY. Dynamika biznesu słabnie.`, metric: `Growth: ${g1.toFixed(0)}% → ${g2.toFixed(0)}%`, trend: "worsening" })
          earningsScore += 1
        }
      }
    }

    // SBC dilution
    const cfAnnual = earnings.cashFlowAnnual ?? []
    if (cfAnnual.length >= 2) {
      const latestCf = cfAnnual[cfAnnual.length - 1]
      if (latestCf.stockBasedCompensation != null && latestCf.operatingCashFlow != null && latestCf.operatingCashFlow > 0) {
        const sbcRatio = (latestCf.stockBasedCompensation / latestCf.operatingCashFlow) * 100
        if (sbcRatio > 50) {
          earningsItems.push({ category: "earnings", severity: "high", title: "SBC stanowi >50% OCF", description: `Wynagrodzenie w akcjach (${sbcRatio.toFixed(0)}% OCF) rozmywa wartość akcjonariuszy. Duża część cash flow to pozycja niegrówkowa.`, metric: `SBC/OCF: ${sbcRatio.toFixed(0)}%` })
          earningsScore += 2
        } else if (sbcRatio > 30) {
          earningsItems.push({ category: "earnings", severity: "medium", title: "Wysokie SBC", description: `SBC stanowi ${sbcRatio.toFixed(0)}% przepływów operacyjnych — istotne rozmywanie akcjonariuszy.`, metric: `SBC/OCF: ${sbcRatio.toFixed(0)}%` })
          earningsScore += 1
        }
      }
    }

    // Share dilution
    const bsAnnual = (earnings.balanceSheetAnnual ?? []).filter(b => b.sharesOutstanding != null)
    if (bsAnnual.length >= 2) {
      const latest = bsAnnual[bsAnnual.length - 1].sharesOutstanding!
      const prev = bsAnnual[bsAnnual.length - 2].sharesOutstanding!
      if (prev > 0) {
        const dilution = ((latest - prev) / prev) * 100
        if (dilution > 5) {
          earningsItems.push({ category: "earnings", severity: "high", title: "Znacząca rozwodnienie akcji", description: `Liczba akcji wzrosła o ${dilution.toFixed(1)}% YoY. Wartość na akcję jest aktywnie rozmywana.`, metric: `Dilution: +${dilution.toFixed(1)}%`, trend: "worsening" })
          earningsScore += 2
        } else if (dilution < -2) {
          positiveFactors.push(`Buyback — spółka skupuje akcje (${dilution.toFixed(1)}% YoY)`)
          earningsScore -= 1
        }
      }
    }

    // Net income trend
    if (annualStmts.length >= 2) {
      const latestNI = annualStmts[annualStmts.length - 1].netIncome
      const prevNI = annualStmts[annualStmts.length - 2].netIncome
      if (latestNI != null && prevNI != null && prevNI > 0 && latestNI < 0) {
        earningsItems.push({ category: "earnings", severity: "critical", title: "Przejście w stratę netto", description: `Spółka przeszła z zysku do straty netto. Fundamentalna zmiana w rentowności — wymaga głębszej analizy przyczyn.`, trend: "worsening" })
        earningsScore += 3
      }
    }
  }

  earningsScore = clamp(earningsScore, 1, 10)

  // ══════════════════════════════════════════════════════════
  // 3. RYZYKO FUNDAMENTALNE — oparte WYŁĄCZNIE na danych liczbowych
  // ══════════════════════════════════════════════════════════
  const fundamentalItems: RiskItem[] = []
  let fundamentalScore = 3

  const sector = stats?.sector ?? ""
  const rg = stats?.revenueGrowth

  // Margin pressure — based on actual numbers
  const pm = stats?.profitMargin
  const om = stats?.operatingMargin
  if (pm != null && pm < 0.03 && om != null && om < 0.05) {
    fundamentalItems.push({ category: "fundamental", severity: "high", title: "Bardzo niskie marże", description: `Marża netto ${(pm*100).toFixed(1)}% i operacyjna ${(om*100).toFixed(1)}% — spółka operuje na granicy rentowności. Minimalna przestrzeń na absorpcję szoków kosztowych.`, metric: `Net: ${(pm*100).toFixed(1)}% | Op: ${(om*100).toFixed(1)}%` })
    fundamentalScore += 2
  } else if (pm != null && pm > 0.2) {
    positiveFactors.push(`Wysoka rentowność (marża netto ${(pm*100).toFixed(1)}%) — bufor na gorsze czasy`)
  }

  // Operating margin declining (from earnings annual data)
  if (earnings) {
    const annStmts = (earnings.annualStatements ?? []).filter(a => a.revenue != null && a.revenue > 0)
    if (annStmts.length >= 2) {
      const latestA = annStmts[annStmts.length - 1]
      const prevA = annStmts[annStmts.length - 2]
      if (latestA.netIncome != null && prevA.netIncome != null && latestA.revenue && prevA.revenue) {
        const mLatest = (latestA.netIncome / latestA.revenue) * 100
        const mPrev = (prevA.netIncome / prevA.revenue) * 100
        if (mLatest < mPrev - 5) {
          fundamentalItems.push({ category: "fundamental", severity: "medium", title: "Spadek marży netto", description: `Marża netto spadła z ${mPrev.toFixed(1)}% do ${mLatest.toFixed(1)}% YoY (${(mLatest - mPrev).toFixed(1)}pp). Koszty rosną szybciej niż przychody.`, metric: `Marża: ${mPrev.toFixed(1)}% → ${mLatest.toFixed(1)}%`, trend: "worsening" })
          fundamentalScore += 1
        }
      }
    }
  }

  // Revenue decline
  if (rg != null && rg < -0.05) {
    fundamentalItems.push({ category: "fundamental", severity: "high", title: "Spadające przychody", description: `Przychody spadły o ${(rg*100).toFixed(1)}% YoY — dane z ostatniego raportu. Spółka traci skalę biznesu.`, metric: `Rev Growth: ${(rg*100).toFixed(1)}%`, trend: "worsening" })
    fundamentalScore += 2
  } else if (rg != null && rg > 0.15) {
    positiveFactors.push(`Silny wzrost przychodów (${(rg*100).toFixed(1)}% YoY)`)
    fundamentalScore -= 1
  }

  // ROE declining or negative
  const roe = stats?.returnOnEquity
  if (roe != null && roe < 0) {
    fundamentalItems.push({ category: "fundamental", severity: "high", title: "Ujemny ROE", description: `Return on Equity wynosi ${(roe*100).toFixed(1)}% — spółka nie generuje zysku z kapitału własnego.`, metric: `ROE: ${(roe*100).toFixed(1)}%` })
    fundamentalScore += 1
  } else if (roe != null && roe > 0.2) {
    positiveFactors.push(`Silny ROE (${(roe*100).toFixed(1)}%) — efektywne wykorzystanie kapitału`)
  }

  fundamentalScore = clamp(fundamentalScore, 1, 10)

  // ══════════════════════════════════════════════════════════
  // 3B. RYZYKO WYCENY I SENTYMENTU — wyłącznie dane liczbowe
  // ══════════════════════════════════════════════════════════
  const valuationItems: RiskItem[] = []
  let valuationScore = 3

  // Price drawdown from 52w high — factual market data
  const drawdown = q.high52 > 0 ? ((q.high52 - q.price) / q.high52) * 100 : 0
  if (drawdown > 30) {
    valuationItems.push({ category: "fundamental", severity: "high", title: `Wyprzedaż -${drawdown.toFixed(0)}% od szczytu 52W`, description: `Kurs spadł z ${q.high52.toFixed(2)} do ${q.price.toFixed(2)} (${q.currency}), tj. -${drawdown.toFixed(1)}% od 52-tygodniowego szczytu. Przy MCap ${(q.marketCap/1e9).toFixed(1)}B to utrata ${((q.high52 - q.price) / q.high52 * q.marketCap / 1e9).toFixed(1)}B kapitalizacji.`, metric: `${q.high52.toFixed(2)} → ${q.price.toFixed(2)}`, trend: "worsening" })
    valuationScore += 3
  } else if (drawdown > 15) {
    valuationItems.push({ category: "fundamental", severity: "medium", title: `Korekta -${drawdown.toFixed(0)}% od szczytu 52W`, description: `Kurs spadł z ${q.high52.toFixed(2)} do ${q.price.toFixed(2)} (${q.currency}).`, metric: `Drawdown: -${drawdown.toFixed(0)}%`, trend: "worsening" })
    valuationScore += 2
  }

  // Forward P/E vs revenue growth — PEG-like analysis
  const fpe = q.forwardPE
  if (fpe != null && rg != null && rg > 0) {
    const impliedPEG = fpe / (rg * 100)
    if (impliedPEG > 3 && fpe > 25) {
      valuationItems.push({ category: "fundamental", severity: "high", title: "Wycena nieproporcjonalna do wzrostu", description: `Forward P/E ${fpe.toFixed(1)}x przy wzroście przychodów ${(rg*100).toFixed(1)}% daje implikowany PEG ${impliedPEG.toFixed(1)}x (norma <2x). Rynek płaci za wzrost ${impliedPEG.toFixed(1)}x premium — uzasadnienie tak wysokiej wyceny wymaga przyspieszenia wzrostu.`, metric: `P/E: ${fpe.toFixed(1)}x | Growth: ${(rg*100).toFixed(1)}% | PEG: ${impliedPEG.toFixed(1)}x` })
      valuationScore += 2
    } else if (impliedPEG < 1) {
      positiveFactors.push(`Atrakcyjny PEG (${impliedPEG.toFixed(1)}x) — wycena niska vs tempo wzrostu`)
    }
  } else if (fpe != null && fpe > 40) {
    valuationItems.push({ category: "fundamental", severity: "medium", title: `Wysoka wycena (Fwd P/E: ${fpe.toFixed(1)}x)`, description: `Forward P/E ${fpe.toFixed(1)}x — wymaga utrzymania silnego wzrostu. Każde rozczarowanie może wywołać większą korektę niż u tańszych spółek.`, metric: `Fwd P/E: ${fpe.toFixed(1)}x` })
    valuationScore += 1
  }

  // CapEx intensity — REAL DATA from cash flow
  if (earnings) {
    const cfAnn = (earnings.cashFlowAnnual ?? []).filter(c => c.capitalExpenditure != null)
    const annStmts = (earnings.annualStatements ?? []).filter(a => a.revenue != null && a.revenue > 0)
    if (cfAnn.length >= 2 && annStmts.length >= 2) {
      const latestCapex = Math.abs(cfAnn[cfAnn.length - 1].capitalExpenditure ?? 0)
      const prevCapex = Math.abs(cfAnn[cfAnn.length - 2].capitalExpenditure ?? 0)
      const latestRev = annStmts[annStmts.length - 1].revenue!
      const prevRev = annStmts[annStmts.length - 2].revenue!

      const capexIntensityNow = (latestCapex / latestRev) * 100
      const capexIntensityPrev = prevRev > 0 ? (prevCapex / prevRev) * 100 : 0
      const capexGrowth = prevCapex > 0 ? ((latestCapex - prevCapex) / prevCapex) * 100 : 0
      const revGrowthPct = prevRev > 0 ? ((latestRev - prevRev) / prevRev) * 100 : 0

      // CapEx growing FASTER than revenue = investment outpacing returns
      if (capexGrowth > revGrowthPct + 15 && capexIntensityNow > 10) {
        valuationItems.push({ category: "fundamental", severity: "high", title: "CapEx rośnie szybciej niż przychody", description: `Wydatki kapitałowe wzrosły ${capexGrowth.toFixed(0)}% YoY vs przychody +${revGrowthPct.toFixed(0)}% YoY. CapEx/Revenue wzrósł z ${capexIntensityPrev.toFixed(1)}% do ${capexIntensityNow.toFixed(1)}%. Inwestycje wyprzedzają monetyzację — ryzyko niskiego ROI z nowych wydatków (np. AI, data centers).`, metric: `CapEx: +${capexGrowth.toFixed(0)}% | Rev: +${revGrowthPct.toFixed(0)}% | Intensity: ${capexIntensityNow.toFixed(1)}%` })
        valuationScore += 2
      } else if (capexIntensityNow > 20) {
        valuationItems.push({ category: "fundamental", severity: "medium", title: "Wysoka intensywność CapEx", description: `CapEx stanowi ${capexIntensityNow.toFixed(1)}% przychodów (${(latestCapex/1e9).toFixed(1)}B ${q.currency}). Wysoki capex może ograniczać FCF w krótkim terminie.`, metric: `CapEx/Rev: ${capexIntensityNow.toFixed(1)}%` })
        valuationScore += 1
      } else if (capexIntensityNow < 5) {
        positiveFactors.push(`Niski CapEx (${capexIntensityNow.toFixed(1)}% rev) — model asset-light`)
      }
    }

    // Revenue growth deceleration — REAL multi-year comparison
    const annStmts3 = (earnings.annualStatements ?? []).filter(a => a.revenue != null && a.revenue > 0)
    if (annStmts3.length >= 3) {
      const r2 = annStmts3[annStmts3.length - 1].revenue!
      const r1 = annStmts3[annStmts3.length - 2].revenue!
      const r0 = annStmts3[annStmts3.length - 3].revenue!
      const g_prev = ((r1 - r0) / r0) * 100
      const g_curr = ((r2 - r1) / r1) * 100
      const decel = g_prev - g_curr
      if (decel > 5 && g_curr > 0 && fpe != null && fpe > 20) {
        valuationItems.push({ category: "fundamental", severity: "high", title: "Spowolnienie wzrostu przy wysokiej wycenie", description: `Wzrost przychodów: ${g_prev.toFixed(1)}% (FY${annStmts3[annStmts3.length-2].date.slice(0,4)}) → ${g_curr.toFixed(1)}% (FY${annStmts3[annStmts3.length-1].date.slice(0,4)}), spadek o ${decel.toFixed(1)}pp. Przy Fwd P/E ${fpe.toFixed(1)}x — rynek może de-ratingować spółkę jeśli trend się utrzyma.`, metric: `Growth: ${g_prev.toFixed(0)}% → ${g_curr.toFixed(0)}% | P/E: ${fpe.toFixed(0)}x`, trend: "worsening" })
        valuationScore += 2
      } else if (g_curr > g_prev + 5) {
        positiveFactors.push(`Przyspieszający wzrost (${g_prev.toFixed(0)}% → ${g_curr.toFixed(0)}% YoY)`)
      }
    }
  }

  // Short interest — factual data
  const shortPct = stats?.shortPercentOfFloat
  if (shortPct != null && shortPct > 0.05) {
    valuationItems.push({ category: "fundamental", severity: "medium", title: `Short Interest: ${(shortPct*100).toFixed(1)}%`, description: `${(shortPct*100).toFixed(1)}% akcji w obiegu jest shortowane. Dane z raportu — instytucje obstawiają spadek.`, metric: `Short: ${(shortPct*100).toFixed(1)}%` })
    valuationScore += 1
  }

  // Insider selling — factual from ownership data
  if (earnings?.ownership) {
    const ow = earnings.ownership
    const netSells = ow.netInsiderSellCount ?? 0
    const netBuys = ow.netInsiderBuyCount ?? 0
    if (netSells > netBuys + 3) {
      valuationItems.push({ category: "fundamental", severity: "medium", title: `Netto sprzedaż insiderów (${netSells} sells vs ${netBuys} buys)`, description: `Insiderzy netto sprzedają akcje: ${netSells} transakcji sprzedaży vs ${netBuys} kupna. Dane z raportów SEC Form 4.`, metric: `Net flow: ${netBuys}↑ / ${netSells}↓`, trend: "worsening" })
      valuationScore += 1
    } else if (netBuys > netSells + 2) {
      positiveFactors.push(`Insiderzy kupują akcje (${netBuys} buys vs ${netSells} sells)`)
    }
  }

  valuationScore = clamp(valuationScore, 1, 10)

  // ══════════════════════════════════════════════════════════
  // 4. RYZYKO MAKROEKONOMICZNE
  // ══════════════════════════════════════════════════════════
  const macroItems: RiskItem[] = []
  let macroScore = 3

  // Interest rate sensitivity (high debt companies)
  if (de != null && de > 100) {
    macroItems.push({ category: "macro", severity: "high", title: "Wrażliwość na stopy procentowe", description: `Przy D/E ${de.toFixed(0)}%, wzrost stóp procentowych znacząco zwiększy koszty obsługi długu i obniży zysk netto.`, metric: `D/E: ${de.toFixed(0)}%` })
    macroScore += 2
  }

  // Beta / volatility
  if (q.beta != null && q.beta > 1.5) {
    macroItems.push({ category: "macro", severity: "medium", title: "Wysoka zmienność (Beta > 1.5)", description: `Beta ${q.beta.toFixed(2)} — spółka reaguje silniej niż rynek na zmiany makro. W recesji spadki będą głębsze niż indeks.`, metric: `Beta: ${q.beta.toFixed(2)}` })
    macroScore += 1
  }

  // Sector-specific macro risks
  if (sector.includes("Real Estate")) {
    macroItems.push({ category: "macro", severity: "high", title: "Sektor wrażliwy na stopy", description: "Nieruchomości są bezpośrednio wrażliwe na środowisko stóp procentowych — wyższe stopy = wyższe koszty finansowania i niższe wyceny." })
    macroScore += 1
  } else if (sector.includes("Consumer")) {
    macroItems.push({ category: "macro", severity: "medium", title: "Wrażliwość na koniunkturę konsumencką", description: "Sektor konsumencki jest cykliczny — recesja lub wysoka inflacja bezpośrednio uderza w popyt." })
    macroScore += 1
  } else if (sector.includes("Energy")) {
    macroItems.push({ category: "macro", severity: "medium", title: "Ekspozycja na ceny surowców", description: "Przychody silnie skorelowane z cenami ropy/gazu — zmienność surowców przekłada się na wyniki." })
    macroScore += 1
  } else if (sector.includes("Technology")) {
    macroItems.push({ category: "macro", severity: "low", title: "Technologia — relatywnie defensywna", description: "Sektor tech jest mniej cykliczny, ale narażony na skompresowanie mnożników w środowisku rosnących stóp." })
  }

  // Beta-based recession sensitivity — factual
  if (q.beta != null && q.beta > 1.2 && de != null && de > 50) {
    macroItems.push({ category: "macro", severity: "medium", title: "Wrażliwość na recesję (Beta + dług)", description: `Kombinacja Beta ${q.beta.toFixed(2)} i D/E ${de.toFixed(0)}% oznacza, że w recesji spółka spadnie mocniej niż rynek przy jednoczesnym wyższym ryzyku obsługi długu.`, metric: `Beta: ${q.beta.toFixed(2)} | D/E: ${de.toFixed(0)}%` })
    macroScore += 1
  }

  macroScore = clamp(macroScore, 1, 10)

  // ══════════════════════════════════════════════════════════
  // 5. RYZYKO REGULACYJNE
  // ══════════════════════════════════════════════════════════
  const regulatoryItems: RiskItem[] = []
  let regulatoryScore = 2 // base: low

  // Regulatory risks based on SECTOR classification (not text mining)
  const industry = stats?.industry ?? ""
  if (sector.includes("Healthcare") || industry.toLowerCase().includes("pharma") || industry.toLowerCase().includes("biotech") || industry.toLowerCase().includes("drug")) {
    regulatoryItems.push({ category: "regulatory", severity: "high", title: "Regulacje FDA/EMA (sektor Healthcare)", description: `Branża: ${industry}. Spółki farmaceutyczne i biotechnologiczne podlegają rygorystycznym regulacjom FDA/EMA. Opóźnienia w zatwierdzeniu leków, zmiany w polityce cenowej lub wycofanie produktów mogą istotnie wpłynąć na przychody.` })
    regulatoryScore += 3
  }
  if (sector.includes("Financial")) {
    regulatoryItems.push({ category: "regulatory", severity: "medium", title: "Regulacje sektora finansowego", description: `Branża: ${industry}. Sektor finansowy podlega regulacjom Basel III, Dodd-Frank, wymogom kapitałowym — zmiany przepisów bezpośrednio wpływają na rentowność.` })
    regulatoryScore += 1
  }
  if (sector.includes("Energy")) {
    regulatoryItems.push({ category: "regulatory", severity: "medium", title: "Regulacje środowiskowe (sektor Energy)", description: `Branża: ${industry}. Sektor energetyczny narażony na regulacje emisyjne, carbon tax, ograniczenia wydobycia — zmiany polityki klimatycznej to ryzyko kosztowe.` })
    regulatoryScore += 1
  }
  if (q.marketCap > 500e9) {
    regulatoryItems.push({ category: "regulatory", severity: "medium", title: "Ryzyko antymonopolowe (mega-cap)", description: `MCap ${(q.marketCap/1e9).toFixed(0)}B — spółki o dominującej pozycji rynkowej są częstszym celem postępowań antymonopolowych (FTC, EC, DOJ).`, metric: `MCap: ${(q.marketCap/1e9).toFixed(0)}B` })
    regulatoryScore += 1
  }

  if (regulatoryItems.length === 0) {
    regulatoryItems.push({ category: "regulatory", severity: "low", title: "Standardowe otoczenie regulacyjne", description: "Brak zidentyfikowanych istotnych ryzyk regulacyjnych specyficznych dla spółki." })
  }

  regulatoryScore = clamp(regulatoryScore, 1, 10)

  // ══════════════════════════════════════════════════════════
  // AGGREGATE
  // ══════════════════════════════════════════════════════════
  allItems.push(...financialItems, ...earningsItems, ...fundamentalItems, ...valuationItems, ...macroItems, ...regulatoryItems)

  const categories: RiskCategory[] = [
    {
      name: "Ryzyko finansowe",
      icon: "💰",
      score: financialScore,
      items: financialItems,
      summary: financialScore >= 7 ? "Poważne problemy z zadłużeniem lub płynnością." : financialScore >= 4 ? "Umiarkowane ryzyka bilansowe." : "Bilans w dobrej kondycji.",
    },
    {
      name: "Jakość zysków",
      icon: "📊",
      score: earningsScore,
      items: earningsItems,
      summary: earningsScore >= 7 ? "Pogarszające się wyniki i negatywne rewizje." : earningsScore >= 4 ? "Mieszane sygnały z raportów wynikowych." : "Stabilne i rosnące zyski.",
    },
    {
      name: "Ryzyko fundamentalne",
      icon: "🏢",
      score: fundamentalScore,
      items: fundamentalItems,
      summary: fundamentalScore >= 7 ? "Istotne ryzyka modelu biznesowego." : fundamentalScore >= 4 ? "Umiarkowane ryzyka konkurencyjne." : "Silna pozycja konkurencyjna.",
    },
    {
      name: "Wycena i sentyment",
      icon: "📉",
      score: valuationScore,
      items: valuationItems,
      summary: valuationScore >= 7 ? "Rynek agresywnie przecenia spółkę — ryzyko dalszej kompresji mnożników." : valuationScore >= 4 ? "Podwyższone ryzyko wycenowe — rynek ma wątpliwości." : "Wycena stabilna, brak sygnałów wyprzedaży.",
    },
    {
      name: "Otoczenie makro",
      icon: "🌍",
      score: macroScore,
      items: macroItems,
      summary: macroScore >= 7 ? "Wysoka ekspozycja na czynniki makroekonomiczne." : macroScore >= 4 ? "Umiarkowana wrażliwość makro." : "Relatywnie odporna na czynniki makro.",
    },
    {
      name: "Ryzyko regulacyjne",
      icon: "⚖️",
      score: regulatoryScore,
      items: regulatoryItems,
      summary: regulatoryScore >= 7 ? "Istotne ryzyka regulacyjne." : regulatoryScore >= 4 ? "Umiarkowane ryzyka regulacyjne." : "Niskie ryzyko regulacyjne.",
    },
  ]

  // Overall: weighted average with "worst category" penalty
  // Financial and valuation have highest weight
  const weights = [2.0, 1.5, 1.0, 1.5, 1.0, 0.5] // financial, earnings, fundamental, valuation, macro, regulatory
  const weightedSum = categories.reduce((s, c, i) => s + c.score * weights[i], 0)
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  let avgRisk = weightedSum / totalWeight
  // Penalty: if ANY category is critical (>=8), penalize heavily
  const maxCatScore = Math.max(...categories.map(c => c.score))
  if (maxCatScore >= 8) avgRisk = Math.max(avgRisk, 7.5) // floor at 7.5 if critical risk exists
  else if (maxCatScore >= 7) avgRisk = Math.max(avgRisk, 6.0)
  // Has critical severity items?
  const hasCritical = allItems.some(i => i.severity === "critical")
  if (hasCritical) avgRisk = Math.max(avgRisk, 7.0)
  const overallScore = clamp(Math.round(100 - (avgRisk - 1) * 11.1), 1, 100)

  const riskLevel: "Niskie" | "Umiarkowane" | "Podwyższone" | "Wysokie" | "Krytyczne" =
    overallScore >= 80 ? "Niskie" :
    overallScore >= 60 ? "Umiarkowane" :
    overallScore >= 40 ? "Podwyższone" :
    overallScore >= 20 ? "Wysokie" : "Krytyczne"

  // Top 5 risks sorted by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  const topRisks = [...allItems]
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .slice(0, 5)

  let verdict: string
  if (overallScore >= 75) {
    verdict = `${q.name} wykazuje niski profil ryzyka. Solidne fundamenty finansowe, stabilne wyniki i ograniczona ekspozycja na czynniki zewnętrzne.`
  } else if (overallScore >= 50) {
    verdict = `${q.name} ma umiarkowany profil ryzyka. Niektóre obszary wymagają uwagi, ale ogólna sytuacja finansowa jest akceptowalna.`
  } else if (overallScore >= 30) {
    verdict = `${q.name} wykazuje podwyższone ryzyko. Istotne słabości w fundamentach lub otoczeniu mogą negatywnie wpłynąć na wycenę.`
  } else {
    verdict = `${q.name} ma wysokie ryzyko fundamentalne. Kumulacja negatywnych czynników finansowych i makroekonomicznych wymaga szczególnej ostrożności.`
  }

  return { overallScore, riskLevel, categories, topRisks, positiveFactors, verdict }
}
