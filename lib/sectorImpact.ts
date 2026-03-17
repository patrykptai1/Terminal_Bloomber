/**
 * Geopolitical Sector Impact Analyzer — US Market (GICS Sectors)
 *
 * Maps world news events → GICS sectors (S&P 500 / NASDAQ) → impact direction → tickers
 * Only US-listed companies on NASDAQ and S&P 500.
 */

// ── GICS Sectors ──────────────────────────────────────────────

export const GICS_SECTORS = [
  "Information Technology",
  "Healthcare",
  "Financials",
  "Consumer Discretionary",
  "Consumer Staples",
  "Energy",
  "Industrials",
  "Materials",
  "Utilities",
  "Real Estate",
  "Communication Services",
] as const

export type GICSSector = (typeof GICS_SECTORS)[number]

// ── Types ─────────────────────────────────────────────────────

export interface CompanyTicker {
  symbol: string
  name: string
  index: "S&P500" | "NASDAQ" | "BOTH"
  why: string
}

export interface SectorEffect {
  sector: GICSSector
  impact: "bullish" | "bearish" | "mixed"
  reason: string
  tickers: CompanyTicker[]
}

export interface EventPattern {
  id: string
  name: string
  keywordGroups: string[][]
  effects: SectorEffect[]
}

export interface WorldNewsItemInput {
  id: string
  title: string
  description?: string
  sentiment: "positive" | "negative" | "neutral"
  category: string
  region: string
  date: string
  impact: string
}

export interface SectorSummary {
  sector: GICSSector
  impact: "bullish" | "bearish" | "mixed"
  newsCount: number
  reasons: string[]
  tickers: CompanyTicker[]
  newsItems: { id: string; title: string; sentiment: string }[]
  confidence: "high" | "medium" | "low"
  eventNames: string[]
}

export interface ImpactAnalysis {
  bullish: SectorSummary[]
  bearish: SectorSummary[]
  mixed: SectorSummary[]
  totalNewsAnalyzed: number
  eventsDetected: number
}

// ── Knowledge Base: Events → GICS Sectors → US Tickers ───────

const EVENT_PATTERNS: EventPattern[] = [
  // ═══ MIDDLE EAST CONFLICT ═══
  {
    id: "mideast_war",
    name: "Middle East Conflict",
    keywordGroups: [
      ["iran", "iraq", "syria", "yemen", "lebanon", "hezbollah", "houthi", "gaza", "israel", "middle east", "persian gulf"],
      ["war", "attack", "strike", "missile", "bomb", "military", "conflict", "invasion", "offensive", "airstrikes"]
    ],
    effects: [
      {
        sector: "Energy",
        impact: "bullish",
        reason: "Oil supply risk (Strait of Hormuz = 20% global oil). US producers benefit from price spikes.",
        tickers: [
          { symbol: "XOM", name: "ExxonMobil", index: "S&P500", why: "Largest US oil producer — direct revenue from oil price spike" },
          { symbol: "CVX", name: "Chevron", index: "S&P500", why: "Major integrated oil — higher crude realizations" },
          { symbol: "COP", name: "ConocoPhillips", index: "S&P500", why: "Pure-play E&P — maximum leverage to oil price" },
          { symbol: "OXY", name: "Occidental Petroleum", index: "S&P500", why: "Permian Basin producer — Buffett-backed" },
          { symbol: "HAL", name: "Halliburton", index: "S&P500", why: "Oilfield services — more drilling at higher prices" },
        ]
      },
      {
        sector: "Industrials",
        impact: "bullish",
        reason: "Defense spending surge. US contractors receive accelerated orders for weapons, missiles, drones.",
        tickers: [
          { symbol: "LMT", name: "Lockheed Martin", index: "S&P500", why: "F-35, Patriot — #1 US defense contractor" },
          { symbol: "RTX", name: "RTX (Raytheon)", index: "S&P500", why: "Patriot missiles, air defense — directly deployed" },
          { symbol: "NOC", name: "Northrop Grumman", index: "S&P500", why: "B-21 stealth bomber, surveillance drones" },
          { symbol: "GD", name: "General Dynamics", index: "S&P500", why: "Ammunition, tanks, submarines" },
          { symbol: "LHX", name: "L3Harris", index: "S&P500", why: "Electronic warfare, communications" },
        ]
      },
      {
        sector: "Materials",
        impact: "bullish",
        reason: "Gold = safe-haven demand. Investors flee to precious metals during geopolitical uncertainty.",
        tickers: [
          { symbol: "NEM", name: "Newmont Mining", index: "S&P500", why: "Largest gold miner — leverage to gold price" },
          { symbol: "FCX", name: "Freeport-McMoRan", index: "S&P500", why: "Copper/gold — commodity supercycle" },
        ]
      },
      {
        sector: "Consumer Discretionary",
        impact: "bearish",
        reason: "Airlines hit by fuel costs + route disruptions. Travel/leisure demand softens.",
        tickers: [
          { symbol: "DAL", name: "Delta Air Lines", index: "S&P500", why: "Fuel ~25% of costs — jet fuel spike" },
          { symbol: "UAL", name: "United Airlines", index: "NASDAQ", why: "International routes disrupted" },
          { symbol: "BKNG", name: "Booking Holdings", index: "NASDAQ", why: "Travel bookings decline in conflict zones" },
        ]
      },
      {
        sector: "Financials",
        impact: "bearish",
        reason: "Insurance claims spike. Political risk, cargo, and property insurance payouts increase.",
        tickers: [
          { symbol: "BRK.B", name: "Berkshire Hathaway", index: "S&P500", why: "Major reinsurer — catastrophic claims" },
          { symbol: "TRV", name: "Travelers", index: "S&P500", why: "P&C insurer — war risk exposure" },
        ]
      }
    ]
  },

  // ═══ GULF / HORMUZ / QATAR ═══
  {
    id: "gulf_disruption",
    name: "Persian Gulf / Hormuz Disruption",
    keywordGroups: [
      ["hormuz", "persian gulf", "qatar", "bahrain", "kuwait", "uae", "abu dhabi"],
      ["blockade", "disrupt", "threat", "close", "attack", "naval", "embargo", "sanctions", "war"]
    ],
    effects: [
      {
        sector: "Energy",
        impact: "bullish",
        reason: "Qatar = world's largest LNG exporter. Gulf disruption = LNG crisis. US LNG exporters become critical replacement supply.",
        tickers: [
          { symbol: "LNG", name: "Cheniere Energy", index: "S&P500", why: "Largest US LNG exporter — replacement for Qatar LNG" },
          { symbol: "EQT", name: "EQT Corporation", index: "S&P500", why: "Largest US natural gas producer" },
        ]
      },
      {
        sector: "Materials",
        impact: "bullish",
        reason: "Qatar = ~30% global helium. Gulf disruption = helium shortage. US industrial gas companies have pricing power.",
        tickers: [
          { symbol: "APD", name: "Air Products", index: "S&P500", why: "Major helium producer — US-based supply critical" },
          { symbol: "LIN", name: "Linde plc", index: "S&P500", why: "Global industrial gas leader — helium pricing power" },
        ]
      },
      {
        sector: "Information Technology",
        impact: "bearish",
        reason: "Helium critical for semiconductor manufacturing (cooling, leak detection). Shortage = chip production disruption.",
        tickers: [
          { symbol: "INTC", name: "Intel", index: "BOTH", why: "US fabs use helium — production at risk" },
          { symbol: "NVDA", name: "NVIDIA", index: "BOTH", why: "GPU supply chain dependent on TSMC helium processes" },
          { symbol: "AMAT", name: "Applied Materials", index: "NASDAQ", why: "Chip equipment uses helium in manufacturing" },
        ]
      }
    ]
  },

  // ═══ CHINA-TAIWAN TENSIONS ═══
  {
    id: "china_taiwan",
    name: "China-Taiwan Tensions",
    keywordGroups: [
      ["china", "taiwan", "beijing", "taipei"],
      ["tension", "military", "blockade", "invasion", "threat", "strait", "drills", "exercise", "conflict"]
    ],
    effects: [
      {
        sector: "Information Technology",
        impact: "mixed",
        reason: "Taiwan (TSMC) = 90% advanced chips. US fabs benefit from reshoring (CHIPS Act), but fabless companies (NVDA, AMD) face supply risk.",
        tickers: [
          { symbol: "INTC", name: "Intel", index: "BOTH", why: "BULLISH: US-based fabs — strategic TSMC alternative" },
          { symbol: "NVDA", name: "NVIDIA", index: "BOTH", why: "RISK: TSMC-dependent for GPU manufacturing" },
          { symbol: "AMD", name: "AMD", index: "BOTH", why: "RISK: Relies on TSMC for CPU/GPU production" },
          { symbol: "AMAT", name: "Applied Materials", index: "NASDAQ", why: "BULLISH: US reshoring drives chip equipment demand" },
          { symbol: "LRCX", name: "Lam Research", index: "NASDAQ", why: "BULLISH: Fab diversification = more equipment orders" },
        ]
      },
      {
        sector: "Industrials",
        impact: "bullish",
        reason: "Indo-Pacific military buildup. US Navy expansion, missile defense orders.",
        tickers: [
          { symbol: "LMT", name: "Lockheed Martin", index: "S&P500", why: "F-35 for Pacific allies, missile defense" },
          { symbol: "HII", name: "Huntington Ingalls", index: "S&P500", why: "US Navy shipbuilder — fleet expansion" },
          { symbol: "NOC", name: "Northrop Grumman", index: "S&P500", why: "B-21, drones, submarine tech" },
        ]
      },
      {
        sector: "Consumer Discretionary",
        impact: "bearish",
        reason: "Most electronics assembled in China/Taiwan. iPhones, PCs, servers — supply disruption risk.",
        tickers: [
          { symbol: "AAPL", name: "Apple", index: "BOTH", why: "Heavy China/Taiwan supply chain — iPhone at risk" },
          { symbol: "AMZN", name: "Amazon", index: "BOTH", why: "Device manufacturing + seller supply chains" },
          { symbol: "TSLA", name: "Tesla", index: "BOTH", why: "China factory (Shanghai Gigafactory) exposure" },
        ]
      }
    ]
  },

  // ═══ UKRAINE-RUSSIA ═══
  {
    id: "ukraine_russia",
    name: "Ukraine-Russia Conflict",
    keywordGroups: [
      ["ukraine", "russia", "moscow", "kyiv", "kremlin", "putin", "zelensk"],
      ["war", "attack", "offensive", "missile", "drone", "sanctions", "invasion", "escalat"]
    ],
    effects: [
      {
        sector: "Energy",
        impact: "bullish",
        reason: "Russia was Europe's #1 gas supplier. EU diversifies to US LNG. American LNG exporters are replacement supply.",
        tickers: [
          { symbol: "LNG", name: "Cheniere Energy", index: "S&P500", why: "US LNG #1 exporter — replacement for Russian gas" },
          { symbol: "EQT", name: "EQT Corporation", index: "S&P500", why: "US natgas producer — feeds LNG export terminals" },
          { symbol: "XOM", name: "ExxonMobil", index: "S&P500", why: "Integrated energy — higher oil+gas prices" },
        ]
      },
      {
        sector: "Consumer Staples",
        impact: "bullish",
        reason: "Ukraine+Russia = 30% global wheat. Supply disruption = higher grain prices. US agribusiness benefits.",
        tickers: [
          { symbol: "ADM", name: "Archer-Daniels-Midland", index: "S&P500", why: "Global grain trader — higher commodity margins" },
          { symbol: "BG", name: "Bunge Global", index: "S&P500", why: "Agribusiness — grain trading profits" },
        ]
      },
      {
        sector: "Materials",
        impact: "bullish",
        reason: "Russia = 40% global palladium, major nickel & titanium. Sanctions = supply disruption, non-Russian miners benefit.",
        tickers: [
          { symbol: "NEM", name: "Newmont Mining", index: "S&P500", why: "Gold demand (safe-haven) + mining premium" },
          { symbol: "FCX", name: "Freeport-McMoRan", index: "S&P500", why: "Copper/gold — critical mineral supply" },
          { symbol: "NTR", name: "Nutrien", index: "S&P500", why: "Fertilizer — Russia was major potash exporter" },
        ]
      },
      {
        sector: "Information Technology",
        impact: "bullish",
        reason: "State-sponsored cyberattacks increase. Enterprise cybersecurity spending surge.",
        tickers: [
          { symbol: "CRWD", name: "CrowdStrike", index: "BOTH", why: "Endpoint protection — government demand" },
          { symbol: "PANW", name: "Palo Alto Networks", index: "BOTH", why: "Network security — critical infrastructure" },
          { symbol: "ZS", name: "Zscaler", index: "NASDAQ", why: "Zero-trust security — enterprise adoption" },
          { symbol: "FTNT", name: "Fortinet", index: "BOTH", why: "Firewall/UTM — infrastructure defense" },
        ]
      },
      {
        sector: "Utilities",
        impact: "bullish",
        reason: "Russia enriches 35% global uranium. Sanctions = Western uranium demand spike for nuclear power.",
        tickers: [
          { symbol: "CEG", name: "Constellation Energy", index: "S&P500", why: "Largest US nuclear fleet — uranium price support" },
          { symbol: "VST", name: "Vistra", index: "S&P500", why: "Power generation — energy security premium" },
        ]
      }
    ]
  },

  // ═══ US-CHINA TRADE WAR / TARIFFS ═══
  {
    id: "trade_war",
    name: "US-China Trade War / Tariffs",
    keywordGroups: [
      ["tariff", "trade war", "trade barrier", "import duty", "decoupling", "trade restrict"],
      ["china", "chinese", "beijing"]
    ],
    effects: [
      {
        sector: "Industrials",
        impact: "bullish",
        reason: "Tariffs protect US manufacturers. Reshoring accelerates domestic production.",
        tickers: [
          { symbol: "CAT", name: "Caterpillar", index: "S&P500", why: "US heavy equipment — domestic infra push" },
          { symbol: "DE", name: "Deere & Company", index: "S&P500", why: "US manufacturing — less Chinese competition" },
          { symbol: "GE", name: "GE Aerospace", index: "S&P500", why: "US industrial — reshoring beneficiary" },
        ]
      },
      {
        sector: "Consumer Discretionary",
        impact: "bearish",
        reason: "Tariffs raise prices on Chinese imports. Retailers face margin pressure.",
        tickers: [
          { symbol: "AMZN", name: "Amazon", index: "BOTH", why: "Third-party sellers source from China — price increase" },
          { symbol: "NKE", name: "Nike", index: "S&P500", why: "China manufacturing + China consumer market risk" },
          { symbol: "TSLA", name: "Tesla", index: "BOTH", why: "Shanghai factory retaliatory risk" },
        ]
      },
      {
        sector: "Consumer Staples",
        impact: "bearish",
        reason: "China retaliatory tariffs on US agriculture. Soybean, pork exports decline.",
        tickers: [
          { symbol: "ADM", name: "Archer-Daniels-Midland", index: "S&P500", why: "Soybean/grain exports to China at risk" },
          { symbol: "TSN", name: "Tyson Foods", index: "S&P500", why: "Pork exports — retaliatory tariffs hit" },
        ]
      },
      {
        sector: "Information Technology",
        impact: "mixed",
        reason: "Export controls limit China sales (revenue loss) but CHIPS Act drives domestic investment (benefit).",
        tickers: [
          { symbol: "NVDA", name: "NVIDIA", index: "BOTH", why: "China AI chip ban — revenue loss vs domestic demand" },
          { symbol: "INTC", name: "Intel", index: "BOTH", why: "CHIPS Act beneficiary — US fab investment" },
          { symbol: "AMAT", name: "Applied Materials", index: "NASDAQ", why: "China equipment sales restricted" },
        ]
      }
    ]
  },

  // ═══ FED RATE HIKE ═══
  {
    id: "fed_hike",
    name: "Fed Rate Hike / Hawkish",
    keywordGroups: [
      ["federal reserve", "fed ", "fomc", "powell", "central bank"],
      ["rate hike", "rate increase", "raises rate", "tightening", "hawkish", "higher rate"]
    ],
    effects: [
      {
        sector: "Financials",
        impact: "bullish",
        reason: "Higher rates = wider net interest margins. Banks earn more on loans vs deposits.",
        tickers: [
          { symbol: "JPM", name: "JPMorgan Chase", index: "S&P500", why: "Largest US bank — NIM expansion" },
          { symbol: "BAC", name: "Bank of America", index: "S&P500", why: "Rate-sensitive loan book — margin growth" },
          { symbol: "WFC", name: "Wells Fargo", index: "S&P500", why: "Consumer lending — higher spreads" },
          { symbol: "GS", name: "Goldman Sachs", index: "S&P500", why: "Trading revenue + higher rates" },
        ]
      },
      {
        sector: "Information Technology",
        impact: "bearish",
        reason: "Higher rates reduce present value of future earnings. Growth stocks repriced lower.",
        tickers: [
          { symbol: "NVDA", name: "NVIDIA", index: "BOTH", why: "Growth premium compresses with higher rates" },
          { symbol: "META", name: "Meta Platforms", index: "BOTH", why: "Ad spending softens in tight money" },
          { symbol: "CRM", name: "Salesforce", index: "BOTH", why: "SaaS multiples compress" },
        ]
      },
      {
        sector: "Real Estate",
        impact: "bearish",
        reason: "Higher mortgage costs = lower demand. REIT valuations decline with higher discount rates.",
        tickers: [
          { symbol: "PLD", name: "Prologis", index: "S&P500", why: "Warehouse REIT — higher cap rates" },
          { symbol: "AMT", name: "American Tower", index: "S&P500", why: "Tower REIT — rate-sensitive" },
          { symbol: "SPG", name: "Simon Property", index: "S&P500", why: "Mall REIT — financing costs rise" },
        ]
      },
      {
        sector: "Utilities",
        impact: "bearish",
        reason: "Bond-proxy sector. Higher yields make bonds more attractive vs utility dividends.",
        tickers: [
          { symbol: "NEE", name: "NextEra Energy", index: "S&P500", why: "Largest US utility — dividend yield less competitive" },
          { symbol: "DUK", name: "Duke Energy", index: "S&P500", why: "Higher borrowing costs for capex" },
        ]
      }
    ]
  },

  // ═══ FED RATE CUT ═══
  {
    id: "fed_cut",
    name: "Fed Rate Cut / Dovish",
    keywordGroups: [
      ["federal reserve", "fed ", "fomc", "powell", "central bank"],
      ["rate cut", "lowers rate", "easing", "dovish", "lower rate", "pivot", "rate reduction"]
    ],
    effects: [
      {
        sector: "Information Technology",
        impact: "bullish",
        reason: "Lower discount rate = higher present value of future cash flows. Growth stocks rerate up.",
        tickers: [
          { symbol: "MSFT", name: "Microsoft", index: "BOTH", why: "Tech leader — lower rates support valuations" },
          { symbol: "GOOGL", name: "Alphabet", index: "BOTH", why: "Growth at scale — benefits from easy money" },
          { symbol: "NVDA", name: "NVIDIA", index: "BOTH", why: "AI capex continues in easier money" },
          { symbol: "META", name: "Meta Platforms", index: "BOTH", why: "Ad spend recovers in loose policy" },
        ]
      },
      {
        sector: "Real Estate",
        impact: "bullish",
        reason: "Lower mortgage costs = more home buying. REITs benefit from lower cap rates.",
        tickers: [
          { symbol: "PLD", name: "Prologis", index: "S&P500", why: "Warehouse REIT — lower discount rate" },
          { symbol: "AMT", name: "American Tower", index: "S&P500", why: "Tower REIT — rate-sensitive upside" },
        ]
      },
      {
        sector: "Consumer Discretionary",
        impact: "bullish",
        reason: "Cheaper credit boosts consumer spending on cars, homes, retail.",
        tickers: [
          { symbol: "AMZN", name: "Amazon", index: "BOTH", why: "Consumer spending uptick — AWS + retail" },
          { symbol: "TSLA", name: "Tesla", index: "BOTH", why: "Auto financing cheaper — EV demand rises" },
          { symbol: "HD", name: "Home Depot", index: "S&P500", why: "Home improvement — housing activity boost" },
        ]
      },
      {
        sector: "Financials",
        impact: "bearish",
        reason: "Lower rates compress net interest margins. Banks earn less on loans.",
        tickers: [
          { symbol: "JPM", name: "JPMorgan Chase", index: "S&P500", why: "NIM compression from lower rates" },
          { symbol: "BAC", name: "Bank of America", index: "S&P500", why: "Lending margins narrow" },
        ]
      },
      {
        sector: "Materials",
        impact: "bullish",
        reason: "Lower rates weaken dollar → gold rises. Precious metals = inverse rate correlation.",
        tickers: [
          { symbol: "NEM", name: "Newmont Mining", index: "S&P500", why: "Gold miner — gold rises on rate cuts" },
          { symbol: "FCX", name: "Freeport-McMoRan", index: "S&P500", why: "Copper demand + weaker dollar" },
        ]
      }
    ]
  },

  // ═══ INFLATION ═══
  {
    id: "inflation",
    name: "Inflation Surge",
    keywordGroups: [
      ["inflation", "cpi", "consumer price", "price index", "cost of living"],
      ["surge", "rise", "spike", "high", "record", "accelerat", "soar", "jump"]
    ],
    effects: [
      {
        sector: "Consumer Staples",
        impact: "bullish",
        reason: "Pricing power — essential products. Consumers still buy food/hygiene. Brands pass costs through.",
        tickers: [
          { symbol: "PG", name: "Procter & Gamble", index: "S&P500", why: "Essential products — pricing power" },
          { symbol: "KO", name: "Coca-Cola", index: "S&P500", why: "Brand strength — price increases stick" },
          { symbol: "COST", name: "Costco", index: "BOTH", why: "Bulk buying — value proposition strengthens" },
          { symbol: "WMT", name: "Walmart", index: "S&P500", why: "Everyday low prices — trade-down beneficiary" },
        ]
      },
      {
        sector: "Energy",
        impact: "bullish",
        reason: "Energy commodities are inflation drivers AND hedges. Real asset appreciation.",
        tickers: [
          { symbol: "XOM", name: "ExxonMobil", index: "S&P500", why: "Real asset — oil is inflation hedge" },
          { symbol: "CVX", name: "Chevron", index: "S&P500", why: "Energy = inflation pass-through" },
        ]
      },
      {
        sector: "Consumer Discretionary",
        impact: "bearish",
        reason: "Consumers cut discretionary spending first. Restaurants, luxury, travel decline.",
        tickers: [
          { symbol: "SBUX", name: "Starbucks", index: "BOTH", why: "Premium coffee — budget pressure" },
          { symbol: "MCD", name: "McDonald's", index: "S&P500", why: "Even fast food faces traffic decline" },
          { symbol: "NKE", name: "Nike", index: "S&P500", why: "Discretionary sportswear — spending cut" },
        ]
      },
      {
        sector: "Materials",
        impact: "bullish",
        reason: "Gold = classic inflation hedge. Real assets appreciate as currency purchasing power declines.",
        tickers: [
          { symbol: "NEM", name: "Newmont Mining", index: "S&P500", why: "Gold miner — inflation hedge demand" },
        ]
      }
    ]
  },

  // ═══ OIL PRICE SPIKE ═══
  {
    id: "oil_spike",
    name: "Oil Price Spike / OPEC Cuts",
    keywordGroups: [
      ["oil", "crude", "brent", "wti", "opec", "petroleum"],
      ["surge", "spike", "soar", "jump", "record", "high", "cut", "restrict", "reduce output"]
    ],
    effects: [
      {
        sector: "Energy",
        impact: "bullish",
        reason: "Higher oil = higher revenue and margins for US producers.",
        tickers: [
          { symbol: "XOM", name: "ExxonMobil", index: "S&P500", why: "Integrated — direct price beneficiary" },
          { symbol: "CVX", name: "Chevron", index: "S&P500", why: "Higher crude realizations" },
          { symbol: "COP", name: "ConocoPhillips", index: "S&P500", why: "Pure E&P — max leverage to oil" },
        ]
      },
      {
        sector: "Consumer Discretionary",
        impact: "bearish",
        reason: "Higher gas prices hurt consumer wallets. Auto, travel, retail discretionary decline.",
        tickers: [
          { symbol: "DAL", name: "Delta Air Lines", index: "S&P500", why: "Fuel = ~25% of costs" },
          { symbol: "F", name: "Ford", index: "S&P500", why: "ICE vehicle demand softens, but EV push" },
          { symbol: "TSLA", name: "Tesla", index: "BOTH", why: "BULLISH reversal: high gas drives EV adoption" },
        ]
      },
      {
        sector: "Utilities",
        impact: "bullish",
        reason: "High oil accelerates renewable transition. Solar/wind economics strengthen.",
        tickers: [
          { symbol: "NEE", name: "NextEra Energy", index: "S&P500", why: "Largest wind/solar developer" },
          { symbol: "CEG", name: "Constellation Energy", index: "S&P500", why: "Nuclear = oil-independent power" },
        ]
      }
    ]
  },

  // ═══ AI BREAKTHROUGH ═══
  {
    id: "ai_boom",
    name: "AI / Technology Breakthrough",
    keywordGroups: [
      ["artificial intelligence", "ai ", "chatgpt", "openai", "deepmind", "machine learning", "generative ai", "llm", "large language"],
      ["breakthrough", "launch", "record", "milestone", "revolutio", "transform", "advance", "dominat", "trillion"]
    ],
    effects: [
      {
        sector: "Information Technology",
        impact: "bullish",
        reason: "AI demand drives GPU, cloud, and software investment. Massive data center buildout.",
        tickers: [
          { symbol: "NVDA", name: "NVIDIA", index: "BOTH", why: "AI GPU monopoly — training & inference" },
          { symbol: "MSFT", name: "Microsoft", index: "BOTH", why: "Azure AI + OpenAI partnership + Copilot" },
          { symbol: "GOOGL", name: "Alphabet", index: "BOTH", why: "Google Cloud AI + DeepMind + Gemini" },
          { symbol: "AMD", name: "AMD", index: "BOTH", why: "MI300X AI accelerators — NVDA alternative" },
          { symbol: "AVGO", name: "Broadcom", index: "BOTH", why: "AI networking + custom accelerators" },
          { symbol: "CRM", name: "Salesforce", index: "BOTH", why: "AI-powered CRM — enterprise adoption" },
        ]
      },
      {
        sector: "Utilities",
        impact: "bullish",
        reason: "AI data centers consume massive electricity. Power demand growth unprecedented.",
        tickers: [
          { symbol: "VST", name: "Vistra", index: "S&P500", why: "Power generation — data center contracts" },
          { symbol: "CEG", name: "Constellation Energy", index: "S&P500", why: "Nuclear power for AI data centers" },
          { symbol: "NEE", name: "NextEra Energy", index: "S&P500", why: "Renewables for tech campus power" },
        ]
      },
      {
        sector: "Communication Services",
        impact: "bullish",
        reason: "AI enhances content platforms, advertising targeting, and user engagement.",
        tickers: [
          { symbol: "META", name: "Meta Platforms", index: "BOTH", why: "AI-driven ad targeting + content recommendations" },
          { symbol: "GOOGL", name: "Alphabet", index: "BOTH", why: "Search AI + YouTube AI + ad optimization" },
          { symbol: "NFLX", name: "Netflix", index: "BOTH", why: "AI recommendations + content optimization" },
        ]
      },
      {
        sector: "Real Estate",
        impact: "bullish",
        reason: "Data center REITs benefit from massive AI infrastructure buildout.",
        tickers: [
          { symbol: "EQIX", name: "Equinix", index: "BOTH", why: "Data center REIT — AI demand boom" },
          { symbol: "DLR", name: "Digital Realty", index: "S&P500", why: "Data center REIT — AI capacity expansion" },
        ]
      }
    ]
  },

  // ═══ PANDEMIC ═══
  {
    id: "pandemic",
    name: "Pandemic / Disease Outbreak",
    keywordGroups: [
      ["pandemic", "virus", "outbreak", "epidemic", "bird flu", "avian", "mpox", "disease", "pathogen"],
      ["spread", "surge", "cases", "deaths", "lockdown", "quarantine", "emergency", "variant", "wave"]
    ],
    effects: [
      {
        sector: "Healthcare",
        impact: "bullish",
        reason: "Vaccine and antiviral demand surges. Government pandemic preparedness contracts.",
        tickers: [
          { symbol: "PFE", name: "Pfizer", index: "S&P500", why: "mRNA vaccine platform" },
          { symbol: "MRNA", name: "Moderna", index: "BOTH", why: "mRNA technology leader" },
          { symbol: "GILD", name: "Gilead Sciences", index: "BOTH", why: "Antiviral drugs" },
          { symbol: "ABT", name: "Abbott Labs", index: "S&P500", why: "Diagnostic tests — rapid testing demand" },
          { symbol: "TMO", name: "Thermo Fisher", index: "S&P500", why: "Lab equipment + diagnostics" },
        ]
      },
      {
        sector: "Information Technology",
        impact: "bullish",
        reason: "Remote work drives cloud, collaboration, and e-commerce tech adoption.",
        tickers: [
          { symbol: "MSFT", name: "Microsoft", index: "BOTH", why: "Teams + Azure — WFH infrastructure" },
          { symbol: "ZM", name: "Zoom", index: "NASDAQ", why: "Video conferencing — WFH standard" },
          { symbol: "CRM", name: "Salesforce", index: "BOTH", why: "Cloud CRM — digital transformation" },
        ]
      },
      {
        sector: "Consumer Discretionary",
        impact: "bearish",
        reason: "Travel restrictions, lockdowns = massive demand collapse for travel/leisure.",
        tickers: [
          { symbol: "DAL", name: "Delta Air Lines", index: "S&P500", why: "Air travel demand destruction" },
          { symbol: "MAR", name: "Marriott", index: "S&P500", why: "Hotel occupancy collapse" },
          { symbol: "DIS", name: "Walt Disney", index: "S&P500", why: "Parks closed, movie theaters shut" },
        ]
      }
    ]
  },

  // ═══ NATURAL DISASTER ═══
  {
    id: "disaster",
    name: "Natural Disaster",
    keywordGroups: [
      ["earthquake", "hurricane", "typhoon", "tsunami", "flood", "wildfire", "tornado", "cyclone"]
    ],
    effects: [
      {
        sector: "Financials",
        impact: "bearish",
        reason: "Catastrophic insurance claims. Short-term losses from payouts.",
        tickers: [
          { symbol: "ALL", name: "Allstate", index: "S&P500", why: "Property insurance — claims surge" },
          { symbol: "TRV", name: "Travelers", index: "S&P500", why: "P&C — catastrophe losses" },
          { symbol: "PGR", name: "Progressive", index: "S&P500", why: "Auto/property — storm claims" },
        ]
      },
      {
        sector: "Industrials",
        impact: "bullish",
        reason: "Reconstruction drives demand for construction, infrastructure, equipment.",
        tickers: [
          { symbol: "CAT", name: "Caterpillar", index: "S&P500", why: "Heavy equipment — reconstruction" },
          { symbol: "PWR", name: "Quanta Services", index: "S&P500", why: "Power grid rebuild" },
          { symbol: "GNRC", name: "Generac", index: "S&P500", why: "Backup generators — demand surge" },
        ]
      },
      {
        sector: "Consumer Discretionary",
        impact: "bullish",
        reason: "Home rebuilding drives hardware/materials demand.",
        tickers: [
          { symbol: "HD", name: "Home Depot", index: "S&P500", why: "Building supplies — disaster recovery" },
          { symbol: "LOW", name: "Lowe's", index: "S&P500", why: "Home improvement — reconstruction" },
        ]
      }
    ]
  },

  // ═══ RECESSION ═══
  {
    id: "recession",
    name: "Recession / Economic Downturn",
    keywordGroups: [
      ["recession", "downturn", "contraction", "gdp decline", "economic slowdown", "depression", "hard landing"]
    ],
    effects: [
      {
        sector: "Consumer Staples",
        impact: "bullish",
        reason: "Defensive sector — people still buy food, hygiene, essentials in recessions.",
        tickers: [
          { symbol: "PG", name: "Procter & Gamble", index: "S&P500", why: "Essential products — recession-resistant" },
          { symbol: "KO", name: "Coca-Cola", index: "S&P500", why: "Consumer staple — stable cash flows" },
          { symbol: "PEP", name: "PepsiCo", index: "BOTH", why: "Food + beverage — defensive" },
          { symbol: "WMT", name: "Walmart", index: "S&P500", why: "Trade-down destination — value retail" },
        ]
      },
      {
        sector: "Healthcare",
        impact: "bullish",
        reason: "Non-cyclical demand. Healthcare spending is non-discretionary.",
        tickers: [
          { symbol: "UNH", name: "UnitedHealth", index: "S&P500", why: "Health insurance — recession-proof" },
          { symbol: "JNJ", name: "Johnson & Johnson", index: "S&P500", why: "Pharma + consumer health — defensive" },
          { symbol: "LLY", name: "Eli Lilly", index: "S&P500", why: "Pharma pipeline — economy-independent" },
        ]
      },
      {
        sector: "Consumer Discretionary",
        impact: "bearish",
        reason: "Consumers cut discretionary spending first. Luxury, travel, dining out decline.",
        tickers: [
          { symbol: "AMZN", name: "Amazon", index: "BOTH", why: "Retail volume softens, but AWS holds" },
          { symbol: "SBUX", name: "Starbucks", index: "BOTH", why: "Premium coffee — budget pressure" },
          { symbol: "NKE", name: "Nike", index: "S&P500", why: "Discretionary sportswear cut" },
        ]
      },
      {
        sector: "Financials",
        impact: "bearish",
        reason: "Loan defaults rise, credit quality deteriorates, investment banking slows.",
        tickers: [
          { symbol: "JPM", name: "JPMorgan Chase", index: "S&P500", why: "Credit losses increase" },
          { symbol: "BAC", name: "Bank of America", index: "S&P500", why: "Consumer loan defaults rise" },
        ]
      }
    ]
  },

  // ═══ SUPPLY CHAIN CRISIS ═══
  {
    id: "supply_chain",
    name: "Supply Chain Disruption",
    keywordGroups: [
      ["supply chain", "shipping", "container", "port", "logistics", "freight", "shortage", "bottleneck", "backlog"]
    ],
    effects: [
      {
        sector: "Industrials",
        impact: "bullish",
        reason: "Shipping rates spike. Logistics companies profit from scarcity. Automation investment rises.",
        tickers: [
          { symbol: "FDX", name: "FedEx", index: "S&P500", why: "Air freight demand — alternative to sea" },
          { symbol: "UPS", name: "United Parcel Service", index: "S&P500", why: "Package delivery — premium pricing" },
          { symbol: "GWW", name: "W.W. Grainger", index: "S&P500", why: "Industrial supplies — inventory security" },
        ]
      },
      {
        sector: "Real Estate",
        impact: "bullish",
        reason: "Companies build buffer inventory. Warehouse demand surges.",
        tickers: [
          { symbol: "PLD", name: "Prologis", index: "S&P500", why: "Warehouse REIT — inventory buildup" },
        ]
      },
      {
        sector: "Information Technology",
        impact: "bearish",
        reason: "Component shortages delay product launches. Hardware companies can't ship.",
        tickers: [
          { symbol: "AAPL", name: "Apple", index: "BOTH", why: "iPhone production delays" },
          { symbol: "DELL", name: "Dell Technologies", index: "S&P500", why: "PC/server supply constraints" },
        ]
      }
    ]
  },

  // ═══ SANCTIONS ═══
  {
    id: "sanctions",
    name: "International Sanctions",
    keywordGroups: [
      ["sanction", "embargo", "blacklist", "ban export", "freeze assets", "trade ban"],
      ["russia", "china", "iran", "north korea", "venezuela"]
    ],
    effects: [
      {
        sector: "Materials",
        impact: "bullish",
        reason: "Sanctions on commodity-producing nations restrict supply. US miners gain pricing power.",
        tickers: [
          { symbol: "MP", name: "MP Materials", index: "S&P500", why: "US rare earth — supply chain security" },
          { symbol: "ALB", name: "Albemarle", index: "S&P500", why: "Lithium — domestic supply premium" },
          { symbol: "FCX", name: "Freeport-McMoRan", index: "S&P500", why: "Copper — green transition mineral" },
        ]
      },
      {
        sector: "Financials",
        impact: "bullish",
        reason: "Compliance demand. Sanctions monitoring software and payment rerouting creates business.",
        tickers: [
          { symbol: "V", name: "Visa", index: "S&P500", why: "Payment networks — trade redirection" },
          { symbol: "MA", name: "Mastercard", index: "S&P500", why: "Global payments infrastructure" },
        ]
      }
    ]
  },

  // ═══ CLIMATE / GREEN ENERGY ═══
  {
    id: "climate_policy",
    name: "Climate Policy / Green Push",
    keywordGroups: [
      ["climate", "paris agreement", "green deal", "carbon", "emission", "net zero", "renewable", "clean energy"],
      ["policy", "law", "regulation", "mandate", "invest", "subsid", "incentive", "tax credit", "fund"]
    ],
    effects: [
      {
        sector: "Utilities",
        impact: "bullish",
        reason: "Subsidies + mandates accelerate solar/wind deployment. Tax credits boost returns.",
        tickers: [
          { symbol: "NEE", name: "NextEra Energy", index: "S&P500", why: "Largest US wind/solar developer" },
          { symbol: "CEG", name: "Constellation Energy", index: "S&P500", why: "Nuclear + renewables — clean energy" },
        ]
      },
      {
        sector: "Consumer Discretionary",
        impact: "bullish",
        reason: "EV mandates + purchase subsidies drive electric vehicle adoption.",
        tickers: [
          { symbol: "TSLA", name: "Tesla", index: "BOTH", why: "EV market leader — regulatory credit seller" },
          { symbol: "GM", name: "General Motors", index: "S&P500", why: "EV transition — Ultium platform" },
          { symbol: "F", name: "Ford", index: "S&P500", why: "F-150 Lightning — EV truck segment" },
        ]
      },
      {
        sector: "Energy",
        impact: "bearish",
        reason: "Carbon taxes and phase-out mandates reduce fossil fuel demand long-term.",
        tickers: [
          { symbol: "XOM", name: "ExxonMobil", index: "S&P500", why: "Transition risk — stranded assets" },
          { symbol: "CVX", name: "Chevron", index: "S&P500", why: "Long-term demand decline" },
        ]
      },
      {
        sector: "Information Technology",
        impact: "bullish",
        reason: "Clean energy tech, smart grids, EV software, carbon tracking platforms.",
        tickers: [
          { symbol: "ENPH", name: "Enphase Energy", index: "NASDAQ", why: "Solar microinverters — IRA beneficiary" },
          { symbol: "FSLR", name: "First Solar", index: "NASDAQ", why: "US solar panels — policy tailwind" },
        ]
      }
    ]
  },

  // ═══ PEACE / DE-ESCALATION ═══
  {
    id: "peace",
    name: "Peace / De-escalation",
    keywordGroups: [
      ["peace", "ceasefire", "truce", "agreement", "de-escalat", "withdraw", "diplomatic solution", "peace deal", "negotiat"]
    ],
    effects: [
      {
        sector: "Consumer Discretionary",
        impact: "bullish",
        reason: "Travel confidence restored. Tourism, airlines, hotels rebound.",
        tickers: [
          { symbol: "DAL", name: "Delta Air Lines", index: "S&P500", why: "International routes reopen" },
          { symbol: "MAR", name: "Marriott", index: "S&P500", why: "Hotel demand recovery" },
          { symbol: "BKNG", name: "Booking Holdings", index: "NASDAQ", why: "Travel bookings surge" },
        ]
      },
      {
        sector: "Industrials",
        impact: "bearish",
        reason: "Peace reduces urgency for military spending. Defense budget pressure.",
        tickers: [
          { symbol: "LMT", name: "Lockheed Martin", index: "S&P500", why: "Lower weapons demand" },
          { symbol: "RTX", name: "RTX (Raytheon)", index: "S&P500", why: "Missile orders may decline" },
        ]
      },
      {
        sector: "Energy",
        impact: "bearish",
        reason: "Geopolitical risk premium removed from oil. Prices normalize lower.",
        tickers: [
          { symbol: "XOM", name: "ExxonMobil", index: "S&P500", why: "Lower oil = lower revenue" },
          { symbol: "CVX", name: "Chevron", index: "S&P500", why: "Risk premium removal hits margins" },
        ]
      }
    ]
  },
]

// ── Analysis Engine ───────────────────────────────────────────

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/['']/g, "'").replace(/[""]/g, '"')
}

function matchesKeywordGroup(text: string, group: string[]): boolean {
  return group.some(kw => text.includes(kw.toLowerCase()))
}

function matchesPattern(title: string, description: string | undefined, pattern: EventPattern): boolean {
  const text = normalizeText(`${title} ${description ?? ""}`)
  return pattern.keywordGroups.every(group => matchesKeywordGroup(text, group))
}

export function analyzeNewsImpacts(newsItems: WorldNewsItemInput[]): ImpactAnalysis {
  const allMatches: { news: WorldNewsItemInput; eventId: string; eventName: string; effects: SectorEffect[] }[] = []
  let eventsDetected = 0

  for (const news of newsItems) {
    for (const pattern of EVENT_PATTERNS) {
      if (matchesPattern(news.title, news.description, pattern)) {
        allMatches.push({ news, eventId: pattern.id, eventName: pattern.name, effects: pattern.effects })
        eventsDetected++
      }
    }
  }

  // Aggregate by sector
  const sectorMap = new Map<GICSSector, {
    impacts: Set<string>
    reasons: Set<string>
    tickers: Map<string, CompanyTicker>
    newsItems: Map<string, { id: string; title: string; sentiment: string }>
    confidence: "high" | "medium" | "low"
    eventNames: Set<string>
  }>()

  for (const match of allMatches) {
    for (const effect of match.effects) {
      if (!sectorMap.has(effect.sector)) {
        sectorMap.set(effect.sector, {
          impacts: new Set(),
          reasons: new Set(),
          tickers: new Map(),
          newsItems: new Map(),
          confidence: "low",
          eventNames: new Set()
        })
      }
      const entry = sectorMap.get(effect.sector)!
      entry.impacts.add(effect.impact)
      entry.reasons.add(effect.reason)
      entry.eventNames.add(match.eventName)
      entry.newsItems.set(match.news.id, { id: match.news.id, title: match.news.title, sentiment: match.news.sentiment })

      if (match.news.impact === "high") entry.confidence = "high"
      else if (match.news.impact === "medium" && entry.confidence === "low") entry.confidence = "medium"

      for (const t of effect.tickers) {
        if (!entry.tickers.has(t.symbol)) entry.tickers.set(t.symbol, t)
      }
    }
  }

  const bullish: SectorSummary[] = []
  const bearish: SectorSummary[] = []
  const mixed: SectorSummary[] = []

  for (const [sector, data] of sectorMap) {
    const impactArr = Array.from(data.impacts)
    const finalImpact: "bullish" | "bearish" | "mixed" =
      impactArr.length > 1 ? "mixed" :
      impactArr[0] === "bullish" ? "bullish" :
      impactArr[0] === "bearish" ? "bearish" : "mixed"

    const summary: SectorSummary = {
      sector,
      impact: finalImpact,
      newsCount: data.newsItems.size,
      reasons: Array.from(data.reasons),
      tickers: Array.from(data.tickers.values()),
      newsItems: Array.from(data.newsItems.values()),
      confidence: data.confidence,
      eventNames: Array.from(data.eventNames)
    }

    if (finalImpact === "bullish") bullish.push(summary)
    else if (finalImpact === "bearish") bearish.push(summary)
    else mixed.push(summary)
  }

  const confOrder = { high: 0, medium: 1, low: 2 }
  const sorter = (a: SectorSummary, b: SectorSummary) =>
    b.newsCount - a.newsCount || confOrder[a.confidence] - confOrder[b.confidence]

  bullish.sort(sorter)
  bearish.sort(sorter)
  mixed.sort(sorter)

  return { bullish, bearish, mixed, totalNewsAnalyzed: newsItems.length, eventsDetected }
}
