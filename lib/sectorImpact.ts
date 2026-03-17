/**
 * Geopolitical Sector Impact Analyzer
 *
 * Maps world events → affected economic sectors → impact direction → companies
 * Uses pattern matching with a comprehensive geopolitical knowledge base.
 */

// ── Types ─────────────────────────────────────────────────────

export interface CompanyTicker {
  symbol: string
  name: string
  why: string
}

export interface SectorEffect {
  sector: string
  subsector?: string
  impact: "bullish" | "bearish" | "mixed"
  reason: string
  tickers: CompanyTicker[]
}

export interface EventPattern {
  id: string
  name: string
  /** At least ONE keyword from each group must match (AND between groups, OR within group) */
  keywordGroups: string[][]
  /** Region filter — only match if news is from this region (optional) */
  regionFilter?: string[]
  effects: SectorEffect[]
}

export interface NewsImpactResult {
  newsId: string
  newsTitle: string
  newsSentiment: "positive" | "negative" | "neutral"
  newsCategory: string
  newsRegion: string
  newsDate: string
  matchedEvents: {
    eventId: string
    eventName: string
    effects: (SectorEffect & { confidence: "high" | "medium" | "low" })[]
  }[]
}

export interface SectorSummary {
  sector: string
  subsector?: string
  impact: "bullish" | "bearish" | "mixed"
  newsCount: number
  reasons: string[]
  tickers: CompanyTicker[]
  newsItems: { id: string; title: string; sentiment: string }[]
  confidence: "high" | "medium" | "low"
}

export interface ImpactAnalysis {
  positive: SectorSummary[]  // sectors that BENEFIT
  negative: SectorSummary[]  // sectors that SUFFER
  mixed: SectorSummary[]
  totalNewsAnalyzed: number
  eventsDetected: number
}

// ── Knowledge Base ────────────────────────────────────────────

const EVENT_PATTERNS: EventPattern[] = [
  // ═══════════════════════════════════════════════════
  // MIDDLE EAST CONFLICT
  // ═══════════════════════════════════════════════════
  {
    id: "mideast_war",
    name: "Middle East Military Conflict",
    keywordGroups: [
      ["iran", "iraq", "syria", "yemen", "lebanon", "hezbollah", "houthi", "gaza", "israel", "middle east", "persian gulf"],
      ["war", "attack", "strike", "missile", "bomb", "military", "conflict", "invasion", "offensive", "airstrikes", "troops"]
    ],
    effects: [
      {
        sector: "Energy",
        subsector: "Oil & Gas",
        impact: "bullish",
        reason: "Middle East conflict threatens oil supply routes (Strait of Hormuz handles 20% of global oil). Supply disruption = higher oil prices.",
        tickers: [
          { symbol: "XOM", name: "ExxonMobil", why: "Largest US oil producer — benefits from higher crude prices" },
          { symbol: "CVX", name: "Chevron", why: "Major US oil company — increased revenue from price spikes" },
          { symbol: "OXY", name: "Occidental Petroleum", why: "Significant US shale producer — higher margins" },
          { symbol: "COP", name: "ConocoPhillips", why: "Pure-play E&P — direct beneficiary of oil price increases" },
          { symbol: "HAL", name: "Halliburton", why: "Oilfield services — more drilling activity when prices rise" },
          { symbol: "SLB", name: "Schlumberger", why: "Oilfield services leader — capex increases with oil prices" },
        ]
      },
      {
        sector: "Defense & Aerospace",
        subsector: "Defense Contractors",
        impact: "bullish",
        reason: "Military conflict increases defense spending. Governments order more weapons, ammunition, and defense systems.",
        tickers: [
          { symbol: "LMT", name: "Lockheed Martin", why: "F-35, missile systems — largest US defense contractor" },
          { symbol: "RTX", name: "RTX (Raytheon)", why: "Patriot missiles, air defense systems — directly deployed in conflicts" },
          { symbol: "NOC", name: "Northrop Grumman", why: "B-21 bomber, drones, surveillance systems" },
          { symbol: "GD", name: "General Dynamics", why: "Tanks, submarines, ammunition — ground war beneficiary" },
          { symbol: "LHX", name: "L3Harris Technologies", why: "Communication & electronic warfare systems" },
          { symbol: "BA", name: "Boeing", why: "Defense division — fighter jets, military aircraft" },
        ]
      },
      {
        sector: "Transport",
        subsector: "Airlines",
        impact: "bearish",
        reason: "Higher fuel costs from oil price spikes. Route disruptions around conflict zones. Insurance costs rise.",
        tickers: [
          { symbol: "DAL", name: "Delta Air Lines", why: "Fuel is ~25% of costs — jet fuel price spikes hit margins" },
          { symbol: "UAL", name: "United Airlines", why: "International routes affected by conflict zone rerouting" },
          { symbol: "LUV", name: "Southwest Airlines", why: "Less hedging — more exposed to fuel price volatility" },
        ]
      },
      {
        sector: "Shipping & Logistics",
        subsector: "Maritime Transport",
        impact: "mixed",
        reason: "Suez Canal / Red Sea disruption forces longer routes (Cape of Good Hope). Higher shipping rates benefit shipping companies but hurt importers.",
        tickers: [
          { symbol: "ZIM", name: "ZIM Shipping", why: "Container shipping — rates spike during route disruptions" },
          { symbol: "GOGL", name: "Golden Ocean", why: "Dry bulk shipping — longer routes = more vessel utilization" },
          { symbol: "FDX", name: "FedEx", why: "Air freight alternative demand increases — but fuel costs rise" },
        ]
      },
      {
        sector: "Precious Metals",
        subsector: "Gold & Silver",
        impact: "bullish",
        reason: "War = safe-haven demand. Investors flee to gold during geopolitical uncertainty.",
        tickers: [
          { symbol: "GLD", name: "SPDR Gold ETF", why: "Direct gold exposure — safe haven demand spike" },
          { symbol: "NEM", name: "Newmont Mining", why: "Largest gold miner — leverage to gold price increases" },
          { symbol: "GOLD", name: "Barrick Gold", why: "Major gold producer — margins expand with higher gold" },
          { symbol: "WPM", name: "Wheaton Precious Metals", why: "Streaming company — fixed costs, rising gold/silver prices" },
        ]
      },
      {
        sector: "Insurance",
        subsector: "Reinsurance",
        impact: "bearish",
        reason: "War risk claims increase. Property, cargo, and political risk insurance payouts.",
        tickers: [
          { symbol: "BRK.B", name: "Berkshire Hathaway", why: "Major reinsurer — exposed to catastrophic claims" },
          { symbol: "ALL", name: "Allstate", why: "Insurance claims from supply chain disruptions" },
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════
  // PERSIAN GULF / STRAIT OF HORMUZ
  // ═══════════════════════════════════════════════════
  {
    id: "hormuz_disruption",
    name: "Strait of Hormuz / Gulf Disruption",
    keywordGroups: [
      ["hormuz", "persian gulf", "gulf of oman", "qatar", "bahrain", "kuwait", "uae", "abu dhabi", "dubai"],
      ["blockade", "disrupt", "threat", "close", "attack", "mine", "naval", "embargo", "sanctions", "conflict", "war"]
    ],
    effects: [
      {
        sector: "Energy",
        subsector: "LNG / Natural Gas",
        impact: "bullish",
        reason: "Qatar is world's largest LNG exporter. Gulf disruption = LNG supply crisis. US & Australian LNG producers benefit enormously.",
        tickers: [
          { symbol: "LNG", name: "Cheniere Energy", why: "Largest US LNG exporter — replacement supply for Qatar LNG" },
          { symbol: "AR", name: "Antero Resources", why: "Major US natgas producer — feeds LNG export terminals" },
          { symbol: "EQT", name: "EQT Corporation", why: "Largest US natural gas producer — price spike beneficiary" },
        ]
      },
      {
        sector: "Industrial Gas",
        subsector: "Helium",
        impact: "bullish",
        reason: "Qatar produces ~30% of global helium. Gulf disruption = massive helium supply shortage. US producers (from Federal Helium Reserve) benefit.",
        tickers: [
          { symbol: "APD", name: "Air Products & Chemicals", why: "Major helium producer — US-based supply becomes critical" },
          { symbol: "LIN", name: "Linde plc", why: "Global industrial gas leader — helium pricing power" },
          { symbol: "RGLD", name: "Royal Helium", why: "Canadian helium exploration — benefits from supply scarcity" },
        ]
      },
      {
        sector: "Semiconductors",
        subsector: "Chip Manufacturing",
        impact: "bearish",
        reason: "Helium is critical for semiconductor manufacturing (cooling, leak detection). Helium shortage = chip production disruption.",
        tickers: [
          { symbol: "INTC", name: "Intel", why: "Major chip fabs use helium — production at risk" },
          { symbol: "TSM", name: "TSMC", why: "World's largest chip manufacturer — helium-dependent processes" },
          { symbol: "ASML", name: "ASML", why: "EUV lithography requires helium coolant" },
        ]
      },
      {
        sector: "Fertilizers",
        subsector: "Ammonia / Urea",
        impact: "bullish",
        reason: "Gulf states are major ammonia/urea exporters. Supply disruption = higher fertilizer prices.",
        tickers: [
          { symbol: "NTR", name: "Nutrien", why: "World's largest fertilizer company — benefits from supply shortage" },
          { symbol: "MOS", name: "Mosaic", why: "Major US fertilizer producer — pricing power increase" },
          { symbol: "CF", name: "CF Industries", why: "US nitrogen fertilizer — replacement supplier" },
        ]
      },
      {
        sector: "Aluminum",
        subsector: "Smelting",
        impact: "mixed",
        reason: "UAE (Emirates Global Aluminium) is world's 5th largest aluminum producer. Supply disruption pushes prices up — good for non-Gulf producers, bad for consumers.",
        tickers: [
          { symbol: "AA", name: "Alcoa", why: "US aluminum producer — benefits from higher aluminum prices" },
          { symbol: "CENX", name: "Century Aluminum", why: "US smelter — domestic supply premium" },
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════
  // CHINA-TAIWAN TENSIONS
  // ═══════════════════════════════════════════════════
  {
    id: "china_taiwan",
    name: "China-Taiwan Tensions",
    keywordGroups: [
      ["china", "taiwan", "beijing", "taipei", "pla"],
      ["tension", "military", "exercise", "blockade", "invasion", "threat", "strait", "conflict", "sanctions", "drills"]
    ],
    effects: [
      {
        sector: "Semiconductors",
        subsector: "Advanced Chips",
        impact: "mixed",
        reason: "Taiwan (TSMC) produces 90% of advanced chips. Conflict = global chip shortage. US chip companies with domestic fabs benefit; fabless companies suffer.",
        tickers: [
          { symbol: "INTC", name: "Intel", why: "US-based fabs — strategic alternative to TSMC" },
          { symbol: "GFS", name: "GlobalFoundries", why: "US/EU fabs — supply diversification beneficiary" },
          { symbol: "NVDA", name: "NVIDIA", why: "RISK: TSMC-dependent for GPU manufacturing" },
          { symbol: "AMD", name: "AMD", why: "RISK: Relies on TSMC for CPU/GPU production" },
          { symbol: "AMAT", name: "Applied Materials", why: "Chip equipment — US reshoring drives demand" },
          { symbol: "LRCX", name: "Lam Research", why: "Chip equipment — benefits from fab diversification" },
        ]
      },
      {
        sector: "Defense & Aerospace",
        subsector: "Naval Defense",
        impact: "bullish",
        reason: "Indo-Pacific military buildup. US, Japan, Australia increase defense budgets.",
        tickers: [
          { symbol: "HII", name: "Huntington Ingalls", why: "US Navy shipbuilder — fleet expansion" },
          { symbol: "LMT", name: "Lockheed Martin", why: "F-35 for Pacific allies, missile defense" },
          { symbol: "NOC", name: "Northrop Grumman", why: "B-21, submarines, surveillance drones" },
        ]
      },
      {
        sector: "Consumer Electronics",
        subsector: "Hardware",
        impact: "bearish",
        reason: "Most electronics assembled in China/Taiwan. Supply chain disruption = product shortages and higher prices.",
        tickers: [
          { symbol: "AAPL", name: "Apple", why: "Heavy China/Taiwan supply chain — iPhone production risk" },
          { symbol: "DELL", name: "Dell Technologies", why: "PC/server assembly in Asia — supply disruption" },
          { symbol: "HPQ", name: "HP Inc.", why: "Printing & PC — Asian supply chain dependent" },
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════
  // UKRAINE-RUSSIA CONFLICT
  // ═══════════════════════════════════════════════════
  {
    id: "ukraine_russia",
    name: "Ukraine-Russia Conflict",
    keywordGroups: [
      ["ukraine", "russia", "moscow", "kyiv", "kremlin", "putin", "zelensk"],
      ["war", "attack", "offensive", "missile", "drone", "sanctions", "conflict", "invasion", "escalat", "nuclear"]
    ],
    effects: [
      {
        sector: "Energy",
        subsector: "Natural Gas (Europe)",
        impact: "bullish",
        reason: "Russia was Europe's main gas supplier. Conflict = EU diversification to US LNG. American LNG exporters benefit.",
        tickers: [
          { symbol: "LNG", name: "Cheniere Energy", why: "US LNG #1 exporter — replacement for Russian pipeline gas" },
          { symbol: "TELL", name: "Tellurian", why: "LNG development — European demand pull" },
          { symbol: "EQT", name: "EQT Corporation", why: "Largest US natgas producer — feeds LNG terminals" },
        ]
      },
      {
        sector: "Agriculture",
        subsector: "Grains & Wheat",
        impact: "bullish",
        reason: "Ukraine & Russia = 30% of global wheat exports. Conflict = wheat supply disruption. US/Canadian grain producers benefit.",
        tickers: [
          { symbol: "ADM", name: "Archer-Daniels-Midland", why: "Global grain trader — higher commodity prices" },
          { symbol: "BG", name: "Bunge", why: "Agribusiness — grain trading margins expand" },
          { symbol: "WEAT", name: "Teucrium Wheat ETF", why: "Direct wheat price exposure" },
          { symbol: "NTR", name: "Nutrien", why: "Fertilizer — Russia was major potash/fertilizer exporter" },
        ]
      },
      {
        sector: "Cybersecurity",
        subsector: "Enterprise Security",
        impact: "bullish",
        reason: "State-sponsored cyberattacks increase during conflict. Companies and governments increase cybersecurity spending.",
        tickers: [
          { symbol: "CRWD", name: "CrowdStrike", why: "Endpoint protection — government and enterprise demand" },
          { symbol: "PANW", name: "Palo Alto Networks", why: "Network security leader — critical infrastructure protection" },
          { symbol: "ZS", name: "Zscaler", why: "Zero-trust security — remote work defense" },
          { symbol: "FTNT", name: "Fortinet", why: "Firewall/UTM — infrastructure protection" },
        ]
      },
      {
        sector: "Metals & Mining",
        subsector: "Rare Metals",
        impact: "bullish",
        reason: "Russia is major producer of palladium (40%), nickel, titanium. Sanctions = supply disruption.",
        tickers: [
          { symbol: "SBSW", name: "Sibanye Stillwater", why: "PGM producer — palladium alternative supply" },
          { symbol: "VALE", name: "Vale", why: "Nickel producer — Russia nickel sanctions benefit" },
          { symbol: "PALL", name: "Aberdeen Palladium ETF", why: "Direct palladium exposure" },
        ]
      },
      {
        sector: "Nuclear Energy",
        subsector: "Uranium",
        impact: "bullish",
        reason: "Russia enriches 35% of global uranium. Sanctions on Russian nuclear fuel = Western uranium demand spike.",
        tickers: [
          { symbol: "CCJ", name: "Cameco", why: "World's largest uranium producer — replacement supply" },
          { symbol: "URA", name: "Global X Uranium ETF", why: "Broad uranium sector exposure" },
          { symbol: "LEU", name: "Centrus Energy", why: "US uranium enrichment — strategic domestic supply" },
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════
  // TRADE WAR / TARIFFS
  // ═══════════════════════════════════════════════════
  {
    id: "trade_war_china",
    name: "US-China Trade War / Tariffs",
    keywordGroups: [
      ["tariff", "trade war", "trade barrier", "import duty", "trade restriction", "decoupling"],
      ["china", "chinese", "beijing"]
    ],
    effects: [
      {
        sector: "Manufacturing",
        subsector: "US Domestic Manufacturing",
        impact: "bullish",
        reason: "Tariffs on Chinese imports protect US manufacturers. Reshoring accelerates.",
        tickers: [
          { symbol: "CAT", name: "Caterpillar", why: "US heavy equipment — domestic infrastructure push" },
          { symbol: "DE", name: "Deere & Company", why: "US manufacturing — less Chinese competition" },
          { symbol: "GE", name: "GE Aerospace", why: "US industrial conglomerate — reshoring beneficiary" },
        ]
      },
      {
        sector: "Retail",
        subsector: "Consumer Goods",
        impact: "bearish",
        reason: "Tariffs raise prices on Chinese imports. Retailers face margin pressure or must raise prices.",
        tickers: [
          { symbol: "WMT", name: "Walmart", why: "Heavy Chinese sourcing — cost increase pressure" },
          { symbol: "TGT", name: "Target", why: "Consumer goods sourcing from China — margin compression" },
          { symbol: "NKE", name: "Nike", why: "China manufacturing & China consumer market risk" },
        ]
      },
      {
        sector: "Semiconductors",
        subsector: "Chip Equipment",
        impact: "mixed",
        reason: "Export controls limit sales to China (revenue loss) but drive domestic chip investment (CHIPS Act).",
        tickers: [
          { symbol: "AMAT", name: "Applied Materials", why: "China revenue at risk from export controls" },
          { symbol: "KLAC", name: "KLA Corporation", why: "Wafer inspection — China market restriction" },
          { symbol: "INTC", name: "Intel", why: "CHIPS Act beneficiary — US fab investment" },
        ]
      },
      {
        sector: "Agriculture",
        subsector: "US Farmers",
        impact: "bearish",
        reason: "China retaliatory tariffs on US soybeans, pork. US agricultural exports decline.",
        tickers: [
          { symbol: "ADM", name: "Archer-Daniels-Midland", why: "Soybean exports to China at risk" },
          { symbol: "TSN", name: "Tyson Foods", why: "Pork exports — retaliatory tariffs" },
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════
  // FED / INTEREST RATES
  // ═══════════════════════════════════════════════════
  {
    id: "fed_rate_hike",
    name: "Federal Reserve Rate Hike",
    keywordGroups: [
      ["federal reserve", "fed", "fomc", "powell", "central bank"],
      ["rate hike", "rate increase", "raises rates", "tightening", "hawkish", "higher rates", "rate rise"]
    ],
    effects: [
      {
        sector: "Banking",
        subsector: "Commercial Banks",
        impact: "bullish",
        reason: "Higher rates = wider net interest margins (NIM). Banks earn more on loans vs deposits.",
        tickers: [
          { symbol: "JPM", name: "JPMorgan Chase", why: "Largest US bank — NIM expansion from higher rates" },
          { symbol: "BAC", name: "Bank of America", why: "Rate-sensitive loan portfolio — margin improvement" },
          { symbol: "WFC", name: "Wells Fargo", why: "Consumer lending — higher rate spread" },
        ]
      },
      {
        sector: "Real Estate",
        subsector: "REITs",
        impact: "bearish",
        reason: "Higher rates = higher mortgage costs = lower property demand. REIT valuations decline.",
        tickers: [
          { symbol: "O", name: "Realty Income", why: "REIT — higher discount rate lowers valuation" },
          { symbol: "SPG", name: "Simon Property Group", why: "Mall REIT — financing costs increase" },
          { symbol: "VNQ", name: "Vanguard Real Estate ETF", why: "Broad REIT exposure — rate-sensitive" },
        ]
      },
      {
        sector: "Technology",
        subsector: "Growth Tech",
        impact: "bearish",
        reason: "Higher rates reduce present value of future earnings. Growth stocks with distant profits are repriced lower.",
        tickers: [
          { symbol: "ARKK", name: "ARK Innovation ETF", why: "High-growth tech — most rate-sensitive" },
          { symbol: "SNOW", name: "Snowflake", why: "High growth, not yet profitable — valuation pressure" },
          { symbol: "PLTR", name: "Palantir", why: "Growth premium compresses with higher rates" },
        ]
      },
      {
        sector: "Utilities",
        subsector: "Electric Utilities",
        impact: "bearish",
        reason: "Bond-proxy sector. Higher rates make bonds more attractive vs utility dividends.",
        tickers: [
          { symbol: "NEE", name: "NextEra Energy", why: "Largest US utility — dividend yield less competitive" },
          { symbol: "DUK", name: "Duke Energy", why: "Utility — capital-intensive, higher borrowing costs" },
        ]
      }
    ]
  },
  {
    id: "fed_rate_cut",
    name: "Federal Reserve Rate Cut",
    keywordGroups: [
      ["federal reserve", "fed", "fomc", "powell", "central bank"],
      ["rate cut", "rate reduction", "lowers rates", "easing", "dovish", "lower rates", "rate decrease", "pivot"]
    ],
    effects: [
      {
        sector: "Real Estate",
        subsector: "Homebuilders",
        impact: "bullish",
        reason: "Lower rates = cheaper mortgages = more home buying activity.",
        tickers: [
          { symbol: "LEN", name: "Lennar", why: "Homebuilder — lower mortgage rates drive demand" },
          { symbol: "DHI", name: "D.R. Horton", why: "Largest US homebuilder — volume increase" },
          { symbol: "ITB", name: "iShares Home Construction ETF", why: "Broad homebuilder exposure" },
        ]
      },
      {
        sector: "Technology",
        subsector: "Growth Tech",
        impact: "bullish",
        reason: "Lower discount rates increase present value of future cash flows. Growth stocks rerate higher.",
        tickers: [
          { symbol: "MSFT", name: "Microsoft", why: "Tech leader — lower rates support premium valuations" },
          { symbol: "GOOGL", name: "Alphabet", why: "Growth at scale — benefits from rate environment" },
          { symbol: "META", name: "Meta Platforms", why: "Ad spending recovery in easier monetary conditions" },
        ]
      },
      {
        sector: "Precious Metals",
        subsector: "Gold",
        impact: "bullish",
        reason: "Lower rates reduce opportunity cost of holding gold. Dollar weakens = gold rises.",
        tickers: [
          { symbol: "GLD", name: "SPDR Gold ETF", why: "Direct gold exposure — inverse correlation with rates" },
          { symbol: "NEM", name: "Newmont Mining", why: "Gold miner — leverage to gold price" },
        ]
      },
      {
        sector: "Banking",
        subsector: "Commercial Banks",
        impact: "bearish",
        reason: "Lower rates compress net interest margins. Banks earn less on loans.",
        tickers: [
          { symbol: "JPM", name: "JPMorgan Chase", why: "NIM compression from lower lending rates" },
          { symbol: "BAC", name: "Bank of America", why: "Rate-sensitive — margin pressure" },
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════
  // INFLATION
  // ═══════════════════════════════════════════════════
  {
    id: "inflation_spike",
    name: "Inflation Surge",
    keywordGroups: [
      ["inflation", "cpi", "consumer price", "price index", "cost of living"],
      ["surge", "rise", "spike", "high", "record", "accelerat", "increas", "soar", "jump"]
    ],
    effects: [
      {
        sector: "Commodities",
        subsector: "Hard Assets",
        impact: "bullish",
        reason: "Inflation hedge — real assets appreciate when currency purchasing power declines.",
        tickers: [
          { symbol: "GLD", name: "SPDR Gold ETF", why: "Classic inflation hedge" },
          { symbol: "DBC", name: "Invesco DB Commodity ETF", why: "Broad commodity exposure" },
          { symbol: "BTC-USD", name: "Bitcoin", why: "Digital inflation hedge narrative" },
        ]
      },
      {
        sector: "Consumer Staples",
        subsector: "Food & Beverage",
        impact: "mixed",
        reason: "Can pass costs to consumers (pricing power) but volume may decline. Companies with strong brands benefit.",
        tickers: [
          { symbol: "PG", name: "Procter & Gamble", why: "Pricing power — essential products" },
          { symbol: "KO", name: "Coca-Cola", why: "Brand strength allows price increases" },
          { symbol: "PEP", name: "PepsiCo", why: "Diversified food & beverage — pricing power" },
        ]
      },
      {
        sector: "Retail",
        subsector: "Discount Retail",
        impact: "bullish",
        reason: "Consumers trade down to cheaper options during inflation. Discount stores gain market share.",
        tickers: [
          { symbol: "COST", name: "Costco", why: "Bulk buying — value proposition during inflation" },
          { symbol: "DG", name: "Dollar General", why: "Dollar stores gain as consumers seek bargains" },
          { symbol: "WMT", name: "Walmart", why: "Everyday low prices — inflation beneficiary" },
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════
  // OIL PRICE SHOCK
  // ═══════════════════════════════════════════════════
  {
    id: "oil_price_spike",
    name: "Oil Price Spike / OPEC Cuts",
    keywordGroups: [
      ["oil", "crude", "brent", "wti", "opec", "petroleum"],
      ["surge", "spike", "soar", "jump", "record", "high", "cut", "reduce", "restrict"]
    ],
    effects: [
      {
        sector: "Energy",
        subsector: "Oil Producers",
        impact: "bullish",
        reason: "Higher oil prices directly increase revenue and margins for producers.",
        tickers: [
          { symbol: "XOM", name: "ExxonMobil", why: "Integrated oil major — direct price beneficiary" },
          { symbol: "CVX", name: "Chevron", why: "Major producer — higher realizations" },
          { symbol: "PXD", name: "Pioneer Natural", why: "Permian Basin pure-play — high leverage to oil" },
        ]
      },
      {
        sector: "Renewable Energy",
        subsector: "Solar & Wind",
        impact: "bullish",
        reason: "High oil prices accelerate transition to renewables. Economic case for solar/wind strengthens.",
        tickers: [
          { symbol: "ENPH", name: "Enphase Energy", why: "Solar microinverters — residential solar economics improve" },
          { symbol: "FSLR", name: "First Solar", why: "US solar panels — energy independence narrative" },
          { symbol: "NEE", name: "NextEra Energy", why: "Largest wind/solar developer — policy tailwind" },
        ]
      },
      {
        sector: "Electric Vehicles",
        subsector: "EV Manufacturers",
        impact: "bullish",
        reason: "High gas prices drive EV adoption. Fuel cost savings argument strengthens.",
        tickers: [
          { symbol: "TSLA", name: "Tesla", why: "EV leader — gas price shock drives EV demand" },
          { symbol: "RIVN", name: "Rivian", why: "EV trucks — fleet economics vs diesel" },
          { symbol: "LI", name: "Li Auto", why: "EREV/EV — Chinese market shift from ICE" },
        ]
      },
      {
        sector: "Chemicals",
        subsector: "Petrochemicals",
        impact: "bearish",
        reason: "Oil is feedstock for plastics, chemicals. Higher oil = higher input costs.",
        tickers: [
          { symbol: "DOW", name: "Dow Inc.", why: "Petrochemical giant — feedstock cost increase" },
          { symbol: "LYB", name: "LyondellBasell", why: "Plastics/chemicals — margin compression" },
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════
  // NATURAL DISASTER
  // ══════════════════════════════���════════════════════
  {
    id: "natural_disaster",
    name: "Major Natural Disaster",
    keywordGroups: [
      ["earthquake", "hurricane", "typhoon", "tsunami", "flood", "wildfire", "tornado", "cyclone", "volcano"]
    ],
    effects: [
      {
        sector: "Insurance",
        subsector: "Property Insurance",
        impact: "bearish",
        reason: "Catastrophic claims. Short-term losses from payouts, but long-term premium increases.",
        tickers: [
          { symbol: "ALL", name: "Allstate", why: "Property insurance — claims exposure" },
          { symbol: "TRV", name: "Travelers", why: "P&C insurer — catastrophe losses" },
          { symbol: "PGR", name: "Progressive", why: "Auto/property — storm-related claims" },
        ]
      },
      {
        sector: "Construction",
        subsector: "Building Materials",
        impact: "bullish",
        reason: "Rebuilding effort drives demand for construction materials. Government reconstruction spending.",
        tickers: [
          { symbol: "VMC", name: "Vulcan Materials", why: "Aggregates — infrastructure reconstruction" },
          { symbol: "MLM", name: "Martin Marietta", why: "Building materials — reconstruction demand" },
          { symbol: "HD", name: "Home Depot", why: "Building supplies — disaster recovery sales spike" },
          { symbol: "LOW", name: "Lowe's", why: "Home improvement — reconstruction demand" },
        ]
      },
      {
        sector: "Utilities",
        subsector: "Power Generation",
        impact: "mixed",
        reason: "Infrastructure damage requires costly repairs. But government funding for grid resilience increases.",
        tickers: [
          { symbol: "PWR", name: "Quanta Services", why: "Power grid infrastructure — rebuild/upgrade" },
          { symbol: "GNRC", name: "Generac", why: "Backup generators — demand surge after outages" },
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════
  // AI / TECHNOLOGY BREAKTHROUGH
  // ═══════════════════════════════════════════════════
  {
    id: "ai_breakthrough",
    name: "AI / Technology Breakthrough",
    keywordGroups: [
      ["artificial intelligence", "ai ", "chatgpt", "openai", "deepmind", "machine learning", "generative ai", "llm", "large language model"],
      ["breakthrough", "launch", "release", "record", "milestone", "revolutio", "transform", "advance", "dominat"]
    ],
    effects: [
      {
        sector: "Technology",
        subsector: "AI Infrastructure",
        impact: "bullish",
        reason: "AI demand drives massive data center build-out. GPU, networking, and cloud providers benefit.",
        tickers: [
          { symbol: "NVDA", name: "NVIDIA", why: "AI GPU monopoly — training & inference chips" },
          { symbol: "AVGO", name: "Broadcom", why: "AI networking chips, custom AI accelerators" },
          { symbol: "MSFT", name: "Microsoft", why: "Azure AI, OpenAI partnership, Copilot" },
          { symbol: "GOOGL", name: "Alphabet", why: "Google Cloud AI, DeepMind, Gemini" },
          { symbol: "AMD", name: "AMD", why: "MI300X AI accelerators — NVIDIA alternative" },
        ]
      },
      {
        sector: "Energy",
        subsector: "Power Generation",
        impact: "bullish",
        reason: "AI data centers consume massive electricity. Power demand growth drives utility/energy investment.",
        tickers: [
          { symbol: "VST", name: "Vistra", why: "Power generation — data center power contracts" },
          { symbol: "CEG", name: "Constellation Energy", why: "Nuclear power for AI data centers" },
          { symbol: "FSLR", name: "First Solar", why: "Solar for data center campuses" },
        ]
      },
      {
        sector: "Employment",
        subsector: "Traditional Services",
        impact: "bearish",
        reason: "AI automation threatens white-collar jobs. Customer service, content creation, coding — displacement risk.",
        tickers: [
          { symbol: "CHWY", name: "Chewy", why: "Customer service automation — staff reduction" },
          { symbol: "WIT", name: "Wipro", why: "IT outsourcing — AI replacing service contracts" },
          { symbol: "ACN", name: "Accenture", why: "Consulting disruption — AI replaces entry-level" },
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════
  // PANDEMIC / HEALTH CRISIS
  // ═══════════════════════════════════════════════════
  {
    id: "pandemic",
    name: "Pandemic / Disease Outbreak",
    keywordGroups: [
      ["pandemic", "virus", "outbreak", "epidemic", "covid", "bird flu", "avian", "mpox", "disease", "who declares", "pathogen"],
      ["spread", "surge", "cases", "deaths", "lockdown", "quarantine", "emergency", "variant", "mutation", "wave"]
    ],
    effects: [
      {
        sector: "Healthcare",
        subsector: "Vaccines & Therapeutics",
        impact: "bullish",
        reason: "Vaccine and antiviral demand surges. Government contracts for pandemic preparedness.",
        tickers: [
          { symbol: "PFE", name: "Pfizer", why: "mRNA vaccine platform — rapid pandemic response" },
          { symbol: "MRNA", name: "Moderna", why: "mRNA technology — pandemic vaccine leader" },
          { symbol: "GILD", name: "Gilead Sciences", why: "Antiviral drugs (Remdesivir precedent)" },
          { symbol: "BNTX", name: "BioNTech", why: "mRNA platform — pandemic preparedness" },
        ]
      },
      {
        sector: "E-Commerce",
        subsector: "Online Retail",
        impact: "bullish",
        reason: "Lockdowns drive online shopping. Digital transformation accelerates.",
        tickers: [
          { symbol: "AMZN", name: "Amazon", why: "E-commerce + AWS — pandemic winner" },
          { symbol: "SHOP", name: "Shopify", why: "Enables small business e-commerce" },
        ]
      },
      {
        sector: "Travel & Hospitality",
        subsector: "Airlines & Hotels",
        impact: "bearish",
        reason: "Travel restrictions, quarantines, consumer fear = massive demand collapse.",
        tickers: [
          { symbol: "MAR", name: "Marriott", why: "Hotel chain — occupancy collapse" },
          { symbol: "DAL", name: "Delta Air Lines", why: "Air travel demand destruction" },
          { symbol: "RCL", name: "Royal Caribbean", why: "Cruise industry — complete shutdown risk" },
        ]
      },
      {
        sector: "Remote Work",
        subsector: "Collaboration Tools",
        impact: "bullish",
        reason: "Work-from-home mandate drives adoption of video, cloud, and collaboration tools.",
        tickers: [
          { symbol: "ZM", name: "Zoom", why: "Video conferencing — WFH standard" },
          { symbol: "CRM", name: "Salesforce", why: "Cloud CRM — digital transformation" },
          { symbol: "TEAM", name: "Atlassian", why: "Project management — distributed teams" },
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════
  // SANCTIONS
  // ═══════════════════════════════════════════════════
  {
    id: "sanctions",
    name: "International Sanctions",
    keywordGroups: [
      ["sanction", "embargo", "blacklist", "ban", "restrict", "freeze assets", "trade ban"],
      ["russia", "china", "iran", "north korea", "venezuela"]
    ],
    effects: [
      {
        sector: "Commodities",
        subsector: "Critical Minerals",
        impact: "bullish",
        reason: "Sanctions on commodity-producing nations restrict supply. Non-sanctioned producers gain pricing power.",
        tickers: [
          { symbol: "MP", name: "MP Materials", why: "US rare earth producer — supply chain security" },
          { symbol: "ALB", name: "Albemarle", why: "Lithium — if China-sanctioned, US supply critical" },
          { symbol: "FCX", name: "Freeport-McMoRan", why: "Copper — green transition mineral" },
        ]
      },
      {
        sector: "Finance",
        subsector: "Payment Systems",
        impact: "bullish",
        reason: "Sanctions compliance creates demand for monitoring, screening, and alternative payment systems.",
        tickers: [
          { symbol: "V", name: "Visa", why: "Payment networks benefit from trade redirection" },
          { symbol: "MA", name: "Mastercard", why: "Global payment infrastructure" },
          { symbol: "NICE", name: "NICE Ltd.", why: "Financial compliance & surveillance software" },
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════
  // ENERGY TRANSITION / CLIMATE POLICY
  // ═══════════════════════════════════════════════════
  {
    id: "climate_policy",
    name: "Climate Policy / Green Energy Push",
    keywordGroups: [
      ["climate", "paris agreement", "green deal", "carbon", "emission", "net zero", "renewable", "clean energy", "esg"],
      ["policy", "law", "regulation", "mandate", "target", "goal", "invest", "fund", "subsid", "incentive", "tax credit"]
    ],
    effects: [
      {
        sector: "Renewable Energy",
        subsector: "Solar & Wind",
        impact: "bullish",
        reason: "Government subsidies, tax credits, and mandates accelerate renewable energy deployment.",
        tickers: [
          { symbol: "FSLR", name: "First Solar", why: "US solar — IRA tax credits beneficiary" },
          { symbol: "ENPH", name: "Enphase Energy", why: "Solar microinverters — residential deployment" },
          { symbol: "RUN", name: "Sunrun", why: "Residential solar installer — policy tailwind" },
        ]
      },
      {
        sector: "Electric Vehicles",
        subsector: "EV & Batteries",
        impact: "bullish",
        reason: "EV mandates, purchase subsidies, charging infrastructure investment.",
        tickers: [
          { symbol: "TSLA", name: "Tesla", why: "EV market leader — regulatory credit seller" },
          { symbol: "QS", name: "QuantumScape", why: "Solid-state batteries — next-gen EV tech" },
          { symbol: "CHPT", name: "ChargePoint", why: "EV charging infrastructure" },
        ]
      },
      {
        sector: "Fossil Fuels",
        subsector: "Coal & Oil",
        impact: "bearish",
        reason: "Regulatory pressure, carbon taxes, phase-out mandates reduce fossil fuel demand.",
        tickers: [
          { symbol: "BTU", name: "Peabody Energy", why: "Coal — phase-out pressure" },
          { symbol: "XOM", name: "ExxonMobil", why: "Transition risk — stranded assets concern" },
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════
  // RECESSION FEARS
  // ═══════════════════════════════════════════════════
  {
    id: "recession",
    name: "Recession / Economic Downturn",
    keywordGroups: [
      ["recession", "downturn", "contraction", "gdp decline", "economic slowdown", "depression", "hard landing"]
    ],
    effects: [
      {
        sector: "Consumer Staples",
        subsector: "Defensive",
        impact: "bullish",
        reason: "People still buy food, hygiene products, utilities in recessions. Defensive stocks outperform.",
        tickers: [
          { symbol: "PG", name: "Procter & Gamble", why: "Essential products — recession-resistant demand" },
          { symbol: "JNJ", name: "Johnson & Johnson", why: "Healthcare staple — defensive quality" },
          { symbol: "KO", name: "Coca-Cola", why: "Consumer staple — stable cash flows" },
        ]
      },
      {
        sector: "Luxury & Discretionary",
        subsector: "Premium Brands",
        impact: "bearish",
        reason: "Consumers cut discretionary spending first. Luxury goods demand collapses.",
        tickers: [
          { symbol: "LULU", name: "Lululemon", why: "Premium athleisure — discretionary spending cut" },
          { symbol: "RH", name: "RH (Restoration Hardware)", why: "Luxury furniture — housing-linked" },
          { symbol: "PTON", name: "Peloton", why: "Discretionary fitness — budget pressure" },
        ]
      },
      {
        sector: "Healthcare",
        subsector: "Health Services",
        impact: "bullish",
        reason: "Healthcare spending is non-discretionary. Aging population drives demand regardless of economy.",
        tickers: [
          { symbol: "UNH", name: "UnitedHealth Group", why: "Health insurance — non-cyclical demand" },
          { symbol: "LLY", name: "Eli Lilly", why: "Pharma — pipeline value independent of economy" },
          { symbol: "ABBV", name: "AbbVie", why: "Pharma — recurring revenue drugs" },
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════
  // SUPPLY CHAIN CRISIS
  // ═══════════════════════════════════════════════════
  {
    id: "supply_chain",
    name: "Global Supply Chain Disruption",
    keywordGroups: [
      ["supply chain", "shipping", "container", "port", "logistics", "freight", "backlog", "shortage", "bottleneck"]
    ],
    effects: [
      {
        sector: "Shipping",
        subsector: "Container Lines",
        impact: "bullish",
        reason: "Supply chain disruption = higher freight rates. Shipping companies profit from scarcity.",
        tickers: [
          { symbol: "ZIM", name: "ZIM Shipping", why: "Container shipping — rate spikes = massive profits" },
          { symbol: "MATX", name: "Matson", why: "Pacific shipping — premium rates during disruption" },
        ]
      },
      {
        sector: "Inventory Management",
        subsector: "Warehousing & Automation",
        impact: "bullish",
        reason: "Companies build buffer inventory. Warehouse demand and automation investment increase.",
        tickers: [
          { symbol: "PLD", name: "Prologis", why: "Warehouse REIT — inventory build = space demand" },
          { symbol: "GWW", name: "W.W. Grainger", why: "Industrial distribution — supply security premium" },
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════
  // DOLLAR STRENGTH / WEAKNESS
  // ═══════════════════════════════════════════════════
  {
    id: "dollar_strength",
    name: "US Dollar Surge",
    keywordGroups: [
      ["dollar", "usd", "dxy", "greenback", "dollar index"],
      ["surge", "strong", "rally", "rise", "high", "soar", "strength", "appreciate"]
    ],
    effects: [
      {
        sector: "Multinationals",
        subsector: "US Exporters",
        impact: "bearish",
        reason: "Strong dollar makes US exports more expensive abroad. Foreign revenue translates to fewer dollars.",
        tickers: [
          { symbol: "AAPL", name: "Apple", why: "60% international revenue — FX headwind" },
          { symbol: "MSFT", name: "Microsoft", why: "Global software — currency translation loss" },
          { symbol: "PG", name: "Procter & Gamble", why: "Global consumer — dollar hurts overseas earnings" },
        ]
      },
      {
        sector: "Emerging Markets",
        subsector: "EM Equities",
        impact: "bearish",
        reason: "Strong dollar = capital outflow from EM. Dollar-denominated debt becomes harder to service.",
        tickers: [
          { symbol: "EEM", name: "iShares MSCI EM ETF", why: "Broad EM exposure — capital flight risk" },
          { symbol: "BABA", name: "Alibaba", why: "Chinese tech — yuan depreciation" },
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════
  // PEACE / DE-ESCALATION
  // ═══════════════════════════════════════════════════
  {
    id: "peace_deal",
    name: "Peace Deal / De-escalation",
    keywordGroups: [
      ["peace", "ceasefire", "truce", "agreement", "deal", "negotiat", "de-escalat", "withdraw", "diplomatic"]
    ],
    effects: [
      {
        sector: "Travel & Tourism",
        subsector: "Airlines & Hotels",
        impact: "bullish",
        reason: "Peace restores travel confidence. Tourism rebounds, business travel resumes.",
        tickers: [
          { symbol: "DAL", name: "Delta Air Lines", why: "International routes reopen" },
          { symbol: "MAR", name: "Marriott", why: "Hotel demand recovery" },
          { symbol: "BKNG", name: "Booking Holdings", why: "Travel bookings surge" },
        ]
      },
      {
        sector: "Defense",
        subsector: "Defense Contractors",
        impact: "bearish",
        reason: "Peace reduces urgency for military spending. Defense budgets may be cut.",
        tickers: [
          { symbol: "LMT", name: "Lockheed Martin", why: "Lower weapons orders" },
          { symbol: "RTX", name: "RTX (Raytheon)", why: "Missile demand may decline" },
        ]
      },
      {
        sector: "Energy",
        subsector: "Oil & Gas",
        impact: "bearish",
        reason: "Peace removes geopolitical risk premium from oil prices. Prices decline.",
        tickers: [
          { symbol: "XOM", name: "ExxonMobil", why: "Lower oil prices = lower revenue" },
          { symbol: "CVX", name: "Chevron", why: "Risk premium removal" },
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════
  // ELECTION / POLITICAL CHANGE
  // ═══════════════════════════════════════════════════
  {
    id: "election_uncertainty",
    name: "Election / Political Uncertainty",
    keywordGroups: [
      ["election", "vote", "ballot", "inaugurat", "president", "government", "coalition", "parliament"],
      ["uncertain", "contested", "shock", "surprise", "populist", "radical", "sweep", "landslide", "result"]
    ],
    effects: [
      {
        sector: "Markets",
        subsector: "Volatility",
        impact: "bullish",
        reason: "Political uncertainty increases market volatility. VIX rises, options premiums increase.",
        tickers: [
          { symbol: "VXX", name: "iPath VIX ETN", why: "Volatility exposure — uncertainty = VIX spike" },
          { symbol: "CBOE", name: "Cboe Global Markets", why: "Options exchange — higher volume from volatility" },
        ]
      }
    ]
  }
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

export function analyzeNewsImpacts(newsItems: WorldNewsItemInput[]): ImpactAnalysis {
  const allResults: NewsImpactResult[] = []
  let eventsDetected = 0

  for (const news of newsItems) {
    const matchedEvents: NewsImpactResult["matchedEvents"] = []

    for (const pattern of EVENT_PATTERNS) {
      if (matchesPattern(news.title, news.description, pattern)) {
        // Check region filter if set
        if (pattern.regionFilter && !pattern.regionFilter.includes(news.region)) continue

        const confidence: "high" | "medium" | "low" =
          news.impact === "high" ? "high" :
          news.impact === "medium" ? "medium" : "low"

        matchedEvents.push({
          eventId: pattern.id,
          eventName: pattern.name,
          effects: pattern.effects.map(e => ({ ...e, confidence }))
        })
        eventsDetected++
      }
    }

    if (matchedEvents.length > 0) {
      allResults.push({
        newsId: news.id,
        newsTitle: news.title,
        newsSentiment: news.sentiment,
        newsCategory: news.category,
        newsRegion: news.region,
        newsDate: news.date,
        matchedEvents
      })
    }
  }

  // Aggregate into sector summaries
  const sectorMap = new Map<string, {
    impact: "bullish" | "bearish" | "mixed"
    reasons: Set<string>
    tickers: Map<string, CompanyTicker>
    newsItems: Map<string, { id: string; title: string; sentiment: string }>
    confidence: "high" | "medium" | "low"
    count: number
  }>()

  for (const result of allResults) {
    for (const event of result.matchedEvents) {
      for (const effect of event.effects) {
        const key = effect.subsector ? `${effect.sector} → ${effect.subsector}` : effect.sector

        if (!sectorMap.has(key)) {
          sectorMap.set(key, {
            impact: effect.impact,
            reasons: new Set(),
            tickers: new Map(),
            newsItems: new Map(),
            confidence: effect.confidence,
            count: 0
          })
        }

        const entry = sectorMap.get(key)!
        entry.reasons.add(effect.reason)
        entry.count++
        entry.newsItems.set(result.newsId, {
          id: result.newsId,
          title: result.newsTitle,
          sentiment: result.newsSentiment
        })

        // Upgrade confidence if any effect is higher
        if (effect.confidence === "high") entry.confidence = "high"
        else if (effect.confidence === "medium" && entry.confidence === "low") entry.confidence = "medium"

        // Merge impact — if conflicting, becomes "mixed"
        if (entry.impact !== effect.impact && entry.count > 1) {
          entry.impact = "mixed"
        }

        for (const t of effect.tickers) {
          if (!entry.tickers.has(t.symbol)) {
            entry.tickers.set(t.symbol, t)
          }
        }
      }
    }
  }

  // Convert to sorted arrays
  const positive: SectorSummary[] = []
  const negative: SectorSummary[] = []
  const mixed: SectorSummary[] = []

  for (const [key, data] of sectorMap) {
    const parts = key.split(" → ")
    const summary: SectorSummary = {
      sector: parts[0],
      subsector: parts[1],
      impact: data.impact,
      newsCount: data.newsItems.size,
      reasons: Array.from(data.reasons),
      tickers: Array.from(data.tickers.values()),
      newsItems: Array.from(data.newsItems.values()),
      confidence: data.confidence
    }

    if (data.impact === "bullish") positive.push(summary)
    else if (data.impact === "bearish") negative.push(summary)
    else mixed.push(summary)
  }

  // Sort by newsCount (most relevant first), then confidence
  const confOrder = { high: 0, medium: 1, low: 2 }
  const sorter = (a: SectorSummary, b: SectorSummary) =>
    b.newsCount - a.newsCount || confOrder[a.confidence] - confOrder[b.confidence]

  positive.sort(sorter)
  negative.sort(sorter)
  mixed.sort(sorter)

  return {
    positive,
    negative,
    mixed,
    totalNewsAnalyzed: newsItems.length,
    eventsDetected
  }
}
