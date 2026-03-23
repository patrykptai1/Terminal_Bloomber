/**
 * Comprehensive S&P 500 + NASDAQ-listed stocks organized by GICS sector.
 * Pre-categorized to avoid fetching sector classification from Yahoo Finance.
 * Updated: March 2026
 */

export const SECTOR_TICKERS: Record<string, string[]> = {
  "Information Technology": [
    // S&P 500 Tech
    "AAPL","MSFT","NVDA","AVGO","ORCL","CRM","AMD","ADBE","CSCO","ACN",
    "IBM","INTC","TXN","QCOM","AMAT","NOW","INTU","LRCX","ADI","KLAC",
    "SNPS","CDNS","MRVL","FTNT","PANW","APH","MSI","NXPI","MCHP","TEL",
    "IT","KEYS","ROP","ANSS","ZBRA","CDW","HPQ","DELL","HPE","WDC",
    "STX","NTAP","JNPR","FFIV","SWKS","ON","MPWR","ENPH","SEDG","FSLR",
    "GEN","TRMB","EPAM","TYL","TER","PTC","VRSN","AKAM","CTSH","DXC",
    "LDOS","BAH","SAIC","GLW","BR","JKHY","WEX","PAYC","PCTY","MANH",
    // Additional NASDAQ
    "SMCI","PLTR","CRWD","DDOG","SNOW","ZS","NET","MDB","OKTA","TEAM",
    "WDAY","SPLK","VEEV","HUBS","DOCU","TTD","BILL","CFLT","ESTC","PATH",
    "MNDY","GTLB","DT","S","CRDO","ANET","CIEN","LITE","MTSI","SYNA",
    "WOLF","ACLS","CRUS","DIOD","ALGM","AMBA","POWI","RMBS","SITM","FORM",
    "TENB","RPD","VRNS","QLYS","CYBR","SAIL","SWI","BSY","APPN","BL",
    "TWLO","U","RBLX","GLBE","BRZE","GRAB","DKNG","FOUR","SQ","SHOP",
    "ARM","MELI","SE","GLOB","ABNB",
  ],

  "Healthcare": [
    // S&P 500 Healthcare
    "UNH","LLY","JNJ","ABBV","MRK","TMO","ABT","DHR","AMGN","PFE",
    "BMY","GILD","ISRG","MDT","SYK","ELV","REGN","VRTX","ZTS","BDX",
    "BSX","HCA","CI","IDXX","A","DXCM","IQV","MTD","RMD","HOLX",
    "EW","BAX","TECH","ALGN","BIO","WAT","CRL","MOH","CNC","HUM",
    "COO","XRAY","DGX","LH","STE","VTRS","OGN","TFX","HSIC","INCY",
    "PODD","RVTY","MRNA","ILMN","BIIB","ZBH","PKI","CTLT","WST","GEHC",
    // Additional NASDAQ
    "HZNP","SGEN","ALNY","BMRN","JAZZ","EXAS","MEDP","KRYS","PCVX","NBIX",
    "RARE","INSM","SRPT","IONS","RGEN","NTRA","MASI","NVST","CERT","TXG",
    "BRKR","AZTA","NVCR","UTHR","ARGX","LEGN","CYTK","RVMD","SRRK","CRNX",
    "HRMY","PTCT","FOLD","TGTX","CORT","VCEL","AXNX","ATRC","GKOS","ISEE",
  ],

  "Financials": [
    // S&P 500 Financials
    "JPM","V","MA","BAC","WFC","GS","MS","SPGI","BLK","AXP",
    "C","SCHW","CME","ICE","MMC","AON","PGR","TRV","MET","AIG",
    "AFL","PRU","CB","MCO","MSCI","COF","DFS","ALL","AJG","FIS",
    "FITB","BRO","WRB","HBAN","RJF","CFG","L","RE","RF","KEY",
    "NTRS","MTB","CINF","GL","BEN","IVZ","NDAQ","CBOE","MKTX","FRC",
    "FDS","TROW","WTW","ERIE","AIZ","LNC","ZION","CMA","ALLY","EWBC",
    "SIVB","WAL","FNB","PFG","SEIC","HIG","SYF","ACGL","KNSL","RNR",
    // Additional NASDAQ
    "LPLA","HOOD","SOFI","COIN","IBKR","VIRT","TREE","LC","UPST","PYPL",
    "SQ","AFRM","PAYO","RELY","TOST","BILL","WU","GPN","FLT","FISV",
    "JKHY","PCTY","HQY","LMND","ROOT","OSCR",
  ],

  "Consumer Discretionary": [
    // S&P 500 Consumer Discretionary
    "AMZN","TSLA","HD","MCD","NKE","LOW","SBUX","TJX","BKNG","ABNB",
    "CMG","MAR","RCL","DHI","LEN","GM","F","ROST","YUM","ORLY",
    "AZO","EBAY","ULTA","DRI","BBY","LVS","WYNN","MGM","HAS","POOL",
    "PHM","GPC","NVR","TPR","RL","CCL","NCLH","HLT","WH","IHG",
    "EXPE","LKQ","KMX","GRMN","BWA","LEA","MHK","WHR","PVH","DECK",
    "DPZ","WING","CAVA","TXRH","EAT","CAKE","DINE","DIN","JACK",
    // Additional NASDAQ
    "LULU","ETSY","W","CHWY","DASH","PINS","ROKU","PTON","CVNA","CROX",
    "BIRK","ON","MNST","NFLX","TRIP","TCOM","EDR","DKNG","PENN","CZR",
    "LYFT","UBER","GRAB","CPNG","PDD","JD","BABA",
  ],

  "Consumer Staples": [
    // S&P 500 Consumer Staples
    "PG","PEP","KO","COST","WMT","PM","MO","CL","MDLZ","GIS",
    "KMB","KHC","SJM","HSY","STZ","TSN","CAG","CPB","CLX","CHD",
    "MKC","K","HRL","MNST","KDP","TAP","SPC","CASY","USFD","BG",
    "ADM","TGT","DG","DLTR","SYY","KVUE","EL","BF-B","SAM","FDP",
    // Additional NASDAQ
    "FRPT","CELH","FIZZ","HAIN","UNFI","STKL","SENEA","DAR","INGR","ANDE",
  ],

  "Energy": [
    // S&P 500 Energy
    "XOM","CVX","COP","EOG","SLB","MPC","PSX","OXY","VLO","HES",
    "DVN","FANG","HAL","BKR","TRGP","WMB","KMI","OKE","CTRA","MRO",
    "APA","EQT","DINO","TPL","PXD","MTDR","PR","CHRD","SM","MGY",
    "RRC","AR","SWN","CNX","NOV","FTI","CHX","HP","PTEN","WFRD",
    // Additional NASDAQ
    "LBRT","AROC","GPOR","VTLE","ESTE","REPX","CLNE","NEXT","BE",
  ],

  "Industrials": [
    // S&P 500 Industrials
    "GE","CAT","HON","UNP","UPS","RTX","DE","BA","LMT","GD",
    "NOC","MMM","ITW","EMR","PH","ETN","ROK","GWW","WAB","CTAS",
    "ODFL","CARR","OTIS","CSX","NSC","FDX","WM","RSG","AME","IR",
    "XYL","GNRC","FTV","AOS","SWK","FAST","DOV","VRSK","HUBB","TT",
    "LHX","HWM","HEI","TDG","AXON","PWR","BLDR","WSO","PAYC","URI",
    "DAL","UAL","AAL","LUV","JBHT","CHRW","LSTR","SAIA","XPO","SNDR",
    "GXO","EXPD","MATX","KEX","ARCB","WERN","KNX","HUBG","TFII",
    // Additional NASDAQ
    "CPRT","PAYX","JBHT","LSTR","OLD","ROLL","ESAB","AYI","AAON","MIDD",
    "WTS","FSS","KRNT","ROAD","PRIM","STRL","UFPI","GMS","SITE","APOG",
  ],

  "Materials": [
    // S&P 500 Materials
    "LIN","APD","SHW","ECL","FCX","NEM","DOW","DD","NUE","VMC",
    "MLM","PPG","ALB","IFF","CE","CF","MOS","FMC","BALL","PKG",
    "IP","AVY","EMN","SEE","WRK","AMCR","RPM","SON","OLN","HUN",
    "CC","AXTA","CBT","MERC","KWR","GCP","IOSP","FUL","GEF","ATR",
    // Additional NASDAQ
    "MP","LAC","LTHM","ALTM","UUUU","GATO","HL","CDE","AG","MAG",
    "TECK","RIO","BHP","VALE","CLF","X","STLD","CMC","RS","ATI",
  ],

  "Utilities": [
    // S&P 500 Utilities
    "NEE","DUK","SO","D","AEP","EXC","SRE","XEL","WEC","ES",
    "ED","PEG","AWK","DTE","EIX","FE","AEE","CMS","CNP","PPL",
    "NRG","EVRG","ATO","NI","OGE","PNW","LNT","BKH","AVA","MGEE",
    // Additional
    "AES","VST","CEG","PCG","ETR","IDA","HE","SWX","UTL","OTTR",
  ],

  "Real Estate": [
    // S&P 500 Real Estate
    "PLD","AMT","CCI","EQIX","PSA","SPG","O","DLR","WELL","VICI",
    "AVB","EQR","ARE","MAA","ESS","UDR","KIM","REG","VTR","HST",
    "SBAC","WY","PEAK","CPT","BXP","SLG","HIW","OHI","NNN","STAG",
    "CUBE","EXR","LSI","NSA","FR","REXR","TRNO","COLD","IIPR","GLPI",
    // Additional NASDAQ
    "IRM","LAMR","OUT","MPW","STOR","INVH","SUI","ELS","APLE","RHP",
  ],

  "Communication Services": [
    // S&P 500 Communication Services
    "GOOGL","GOOG","META","NFLX","DIS","CMCSA","T","VZ","TMUS","CHTR",
    "EA","TTWO","WBD","PARA","MTCH","LYV","OMC","IPG","FOXA","FOX",
    "NWSA","NWS","DISH","LUMN","ATUS","MSGS","NYT","SIRI","VRSN",
    // Additional NASDAQ
    "RBLX","PINS","SNAP","ZM","SPOT","ROKU","BMBL","IAC","ANGI","ZI",
    "CARG","YELP","GENI","MGNI","PUBM","DV","IAS","NCNO","VZIO","WMG",
  ],
}

// Polish GPW Main Market
export const PL_TICKERS = [
  "CDR.WA","PKN.WA","PKO.WA","PZU.WA","KGH.WA","PEO.WA","DNP.WA","ALE.WA",
  "SPL.WA","CPS.WA","LPP.WA","MBK.WA","OPL.WA","ING.WA","BNP.WA","MIL.WA",
  "BDX.WA","ALR.WA","BFT.WA","CAR.WA","KRU.WA","DVL.WA","ASB.WA","APR.WA",
  "ECH.WA","RBW.WA","GEA.WA","WPL.WA","TOR.WA","VRG.WA","ENT.WA","ZEP.WA",
  "AMC.WA","MNC.WA","ATC.WA","PCR.WA","BIO.WA","VOX.WA","INK.WA","GPP.WA",
]

// NewConnect
export const NC_TICKERS = [
  "CRJ.WA","TEN.WA","BLO.WA","CIG.WA","CLN.WA","TXT.WA","PCF.WA","IMC.WA",
  "NVT.WA","DCR.WA","UNI.WA","ERB.WA","WTN.WA","PBX.WA","SES.WA","MAB.WA",
  "NTT.WA","MLG.WA","GRN.WA","MDG.WA","NVG.WA","SUN.WA","PHR.WA","HRP.WA",
]

// ── Thematic Sectors ────────────────────────────────────────
// Cross-cutting sectors that span multiple GICS categories.
// A company can belong to multiple thematic sectors.

export interface ThematicSector {
  key: string
  icon: string
  label: string
  description: string
  tickers: string[]  // Mix of US and .WA (Polish) tickers
}

export const THEMATIC_SECTORS: ThematicSector[] = [
  {
    key: "Quantum",
    icon: "⚛️",
    label: "Quantum",
    description: "Quantum computing, quantum encryption, quantum sensors",
    tickers: [
      // Pure-play quantum computing
      "QUBT",    // Quantum Computing Inc — quantum optimization
      "IONQ",    // IonQ — trapped ion quantum computers
      "RGTI",    // Rigetti Computing — superconducting quantum
      "QBTS",    // D-Wave Quantum — quantum annealing
      "ARQQ",    // Arqit Quantum — quantum encryption
      // Big tech with major quantum divisions
      "IBM",     // IBM Quantum — 1000+ qubit processors
      "GOOGL",   // Google Quantum AI — Willow chip
      "MSFT",    // Azure Quantum — topological qubits
      "INTC",    // Intel — silicon spin qubits
      "HON",     // Honeywell — Quantinuum (trapped ion)
      // Quantum infrastructure & components
      "FORM",    // FormFactor — quantum probe stations & testing
      "AMAT",    // Applied Materials — quantum chip fabrication
      "COHR",    // Coherent — lasers for quantum systems
      "MKFG",    // Markforged — precision manufacturing (quantum hardware)
      "NVDA",    // NVIDIA — quantum simulation & hybrid computing
      // Polish
      "CRI.WA",  // Creotech Instruments — quantum & space tech (Poland)
    ],
  },
  {
    key: "Defense",
    icon: "🛡️",
    label: "Obronność",
    description: "Defense contractors, military tech, cybersecurity for defense",
    tickers: [
      // Prime defense contractors
      "LMT",     // Lockheed Martin — F-35, missiles, space defense
      "RTX",     // Raytheon Technologies — missiles, radar, engines
      "NOC",     // Northrop Grumman — B-21 bomber, space systems
      "GD",      // General Dynamics — submarines, tanks, IT systems
      "BA",      // Boeing — military aircraft, defense systems
      "LHX",     // L3Harris Technologies — ISR, comms, space
      "HII",     // Huntington Ingalls — aircraft carriers, submarines
      // Defense electronics & tech
      "TDG",     // TransDigm — aerospace components
      "HEI",     // HEICO — aerospace parts & defense electronics
      "AXON",    // Axon Enterprise — tasers, body cameras, AI for defense
      "PLTR",    // Palantir — defense AI & intelligence platforms
      "LDOS",    // Leidos — defense IT, intelligence, R&D
      "BAH",     // Booz Allen Hamilton — defense consulting & cyber
      "SAIC",    // SAIC — defense IT solutions
      "KTOS",    // Kratos Defense — drones, satellite, missile defense
      "AVAV",    // AeroVironment — military drones (Switchblade)
      "MRCY",    // Mercury Systems — defense electronics
      "SPR",     // Spirit AeroSystems — military aircraft structures
      "SWBI",    // Smith & Wesson — firearms
      "RGR",     // Sturm Ruger — firearms
      "BWXT",    // BWX Technologies — nuclear subs, defense reactors
      // Defense cyber & software
      "CRWD",    // CrowdStrike — gov/defense cybersecurity
      "PANW",    // Palo Alto Networks — defense cyber
      "FTNT",    // Fortinet — DoD cybersecurity
      "NET",     // Cloudflare — defense infrastructure
      "MSI",     // Motorola Solutions — defense comms
      // Polish defense
      "CRI.WA",  // Creotech Instruments — satellite & defense tech
      "PCR.WA",  // PCR — electronic systems
    ],
  },
  {
    key: "Fusion",
    icon: "☢️",
    label: "Fuzja termojądrowa",
    description: "Nuclear fusion energy, plasma tech, superconductors, fusion materials",
    tickers: [
      // Direct fusion exposure / components for fusion reactors
      "AIN",     // Albany International — composite materials for ITER tokamak
      "BWXT",    // BWX Technologies — nuclear components, fusion reactor parts
      "SMR",     // NuScale Power — small modular reactors, fusion-adjacent tech
      "OKLO",    // Oklo — advanced nuclear, micro-reactors
      "LEU",     // Centrus Energy — uranium enrichment, HALEU for fusion
      "NNE",     // Nano Nuclear Energy — micro nuclear reactors
      // Companies invested in fusion startups
      "MSFT",    // Microsoft — signed PPA with Helion Energy (fusion)
      "GOOGL",   // Google — invested in TAE Technologies (fusion)
      "GE",      // GE — turbine tech applicable to fusion power plants
      // Critical materials & components for fusion
      "APD",     // Air Products — tritium/deuterium gases for fusion
      "LIN",     // Linde — cryogenics & gases for superconducting magnets
      "HON",     // Honeywell — control systems for fusion reactors
      "CCJ",     // Cameco — uranium (fusion-fission hybrids)
      "UEC",     // Uranium Energy Corp — uranium supply
      "UUUU",    // Energy Fuels — uranium & rare earths for fusion
      "DNN",     // Denison Mines — uranium
      // Superconducting magnets & laser tech for fusion
      "COHR",    // Coherent — high-power lasers (inertial confinement fusion)
      "AMSC",    // AMSC — superconducting wire for fusion magnets
      "VST",     // Vistra — nuclear energy operator
      "CEG",     // Constellation Energy — largest US nuclear fleet
      // Fusion energy infrastructure
      "ETN",     // Eaton — power management for fusion plants
      "EMR",     // Emerson Electric — automation & control for fusion
    ],
  },
  {
    key: "Space",
    icon: "🚀",
    label: "Kosmos",
    description: "Space exploration, satellites, launch vehicles, space infrastructure",
    tickers: [
      // Pure-play space companies
      "RKLB",    // Rocket Lab — Electron/Neutron rockets, Photon satellites
      "ASTS",    // AST SpaceMobile — space-based cellular broadband
      "LUNR",    // Intuitive Machines — lunar landers (Moon missions)
      "SPIR",    // Spire Global — satellite data analytics
      "RDW",     // Redwire — space infrastructure & 3D printing in space
      "BKSY",    // BlackSky Technology — satellite imagery & analytics
      "SPCE",    // Virgin Galactic — space tourism
      "MNTS",    // Momentus — in-space transport & infrastructure
      "GSAT",    // Globalstar — satellite communications
      "IRDM",    // Iridium Communications — satellite constellation
      "VSAT",    // ViaSat — satellite internet & defense comms
      // Large defense/aerospace with major space divisions
      "BA",      // Boeing — Starliner, SLS, satellites
      "LMT",     // Lockheed Martin — Orion, GPS satellites, Mars missions
      "NOC",     // Northrop Grumman — Cygnus, solid rocket boosters
      "RTX",     // Raytheon — space sensors, satellite systems
      "LHX",     // L3Harris — ISR satellites, space payloads
      "GD",      // General Dynamics — satellite ground systems
      "AVAV",    // AeroVironment — small space systems
      // Space-adjacent tech
      "ANET",    // Arista Networks — data infrastructure for ground stations
      "AMZN",    // Amazon — Project Kuiper satellite constellation
      "EQIX",    // Equinix — satellite ground station colocation
      "DLR",     // Digital Realty — data centers for satellite data
      // Polish space
      "CRI.WA",  // Creotech Instruments — EagleEye satellite, space electronics
      "SES.WA",  // Sescom — space-adjacent engineering
    ],
  },
]

export function getThematicSector(key: string): ThematicSector | undefined {
  return THEMATIC_SECTORS.find(s => s.key === key)
}

// Get all US tickers (deduped)
export function getAllUSTickers(): string[] {
  const set = new Set<string>()
  for (const tickers of Object.values(SECTOR_TICKERS)) {
    for (const t of tickers) set.add(t)
  }
  return Array.from(set)
}

// Get tickers for a specific sector
export function getTickersForSector(sector: string): string[] {
  return SECTOR_TICKERS[sector] ?? []
}

// Get sector for a given ticker (reverse lookup)
const _reverseMap = new Map<string, string>()
for (const [sector, tickers] of Object.entries(SECTOR_TICKERS)) {
  for (const t of tickers) {
    if (!_reverseMap.has(t)) _reverseMap.set(t, sector)
  }
}

export function getSectorForTicker(ticker: string): string | null {
  return _reverseMap.get(ticker) ?? null
}

// Total US stock count
export function getUSStockCount(): number {
  return getAllUSTickers().length
}
