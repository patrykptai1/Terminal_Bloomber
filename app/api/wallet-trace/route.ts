import { NextRequest, NextResponse } from 'next/server'

/**
 * Wallet Trace API
 * Traces outgoing SOL transfers from a wallet to find where profits were sent.
 * Uses Solana RPC with jsonParsed encoding to detect system.transfer instructions.
 */

const HELIUS_KEY = process.env.HELIUS_API_KEY ?? ''
const RPC_URL = HELIUS_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`
  : 'https://api.mainnet-beta.solana.com'

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

// ── Known bots, exchanges & programs to filter out ──────────────────────

const KNOWN_EXCHANGES = new Set([
  '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9',
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  '2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S',
  'AC5RDfQFmDS1deWZos921JfqscXdByf8BKHs5ACWjtW2',
  '2AQdpHJ2JpcEgPiATUXjQxA8QmafFegfQwSLWSprPicm',
  'H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS',
  'GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE',
  '5VCwKtCXgCDuQosQfcz2bU7Qvx5WtPBr4tJFBa9JMmp8',
  '4jBaxMoJhW5LBEnMEhBwWqGjUQobHSm3FoF8BALFaKBk',
  'FWznbcNXWQuHTawe9RxvQ2LdCENssh12dsznf4RiouN5',
  'CJsLwbP1iu5DuUikHEJnLfANgKy6stB2uFgvBBHoyxwz',
  'BmFdpraQhkiDQE6SnfG5PW2vCFtgSbR1RKmhAzk6HN3B',
  'u6PJ8DtQuPFnfmwHbGFULQ4u4EgjDiyYKjVEsynXq2w',
])

// Well-known program addresses & system accounts (not user wallets)
const KNOWN_PROGRAMS = new Set([
  '11111111111111111111111111111111',                  // System Program
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',      // Token Program
  'TokenzQdBNbequrbB6a4Vz98dqZBjGFVkAtFQ6D7MCf',      // Token 2022
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',     // ATA Program
  'ComputeBudget111111111111111111111111111111',        // Compute Budget
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',      // Jupiter v6
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',      // Orca Whirlpool
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',    // Raydium AMM
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK',    // Raydium CLMM
  'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',     // Meteora DLMM
  'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB',    // Meteora Pools
  'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA',      // Pump.fun AMM
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',     // Pump.fun
  'So11111111111111111111111111111111111111112',        // Wrapped SOL
  'SysvarRent111111111111111111111111111111111',        // Rent Sysvar
  'SysvarC1ock11111111111111111111111111111111',        // Clock Sysvar
])

// Known bot/MEV/trading bot fee wallets
const KNOWN_BOTS = new Set([
  'jito11111111111111111111111111111111111111111',      // Jito tip account pattern
  'HWEoBxYs7ssKueFhPDhd8dEHLfnh6NhCYBsbGLRTRMd5',    // Jito tip
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',    // Jito tip
  'ADaUMid9yfUC67HyGMjV3aMFKjxTaURhmPxr8sekE9NB',     // Jito tip
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',    // Jito tip
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSGA58XS4A1w4pdY21A',    // Jito tip
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',    // Jito tip
  'HFqU5x63VTqvQss8hp11i4bPHfjmYFCooLkso983eBMV',    // Jito tip
  'T1pyyaTNZsKv2WcRAB8oVnk93mLJw2XzjtVYqCsaHqt',     // Photon router
])

function isFilteredAddress(addr: string): boolean {
  return KNOWN_EXCHANGES.has(addr) || KNOWN_PROGRAMS.has(addr) || KNOWN_BOTS.has(addr)
}

// ── RPC helpers ──────────────────────────────────────────────────────────

async function rpcCall<T>(body: object): Promise<T> {
  let delay = 2000
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
      cache: 'no-store',
    })
    if (res.status === 429) {
      if (attempt === 3) throw new Error('RPC rate-limited')
      await sleep(delay)
      delay *= 2
      continue
    }
    if (!res.ok) throw new Error(`RPC HTTP ${res.status}`)
    return res.json() as Promise<T>
  }
  throw new Error('RPC max retries')
}

interface SigEntry {
  signature: string
  blockTime: number | null
  err: unknown
}

async function getSignatures(address: string, limit: number): Promise<SigEntry[]> {
  const resp = await rpcCall<{ result: SigEntry[] }>({
    jsonrpc: '2.0', id: 1,
    method: 'getSignaturesForAddress',
    params: [address, { limit, commitment: 'confirmed' }],
  })
  return resp.result ?? []
}

// ── Types ────────────────────────────────────────────────────────────────

interface ParsedInstruction {
  program?: string
  programId?: string
  parsed?: {
    type?: string
    info?: {
      source?: string
      destination?: string
      lamports?: number
    }
  }
}

interface TokenBalEntry {
  accountIndex: number
  mint: string
  owner?: string
  uiTokenAmount: { uiAmount: number | null }
}

interface ParsedTxResult {
  blockTime?: number
  meta?: {
    err: unknown
    preBalances: number[]
    postBalances: number[]
    preTokenBalances?: TokenBalEntry[]
    postTokenBalances?: TokenBalEntry[]
    innerInstructions?: Array<{
      instructions: ParsedInstruction[]
    }>
  } | null
  transaction?: {
    message?: {
      accountKeys?: Array<string | { pubkey: string }>
      instructions?: ParsedInstruction[]
    }
  }
}

export interface TransferDestination {
  address: string
  totalSolReceived: number   // SOL total received from traced wallet
  transferCount: number
  lastTransferAt: number     // unix seconds
  currentSolBalance: number  // current SOL balance of destination
}

export interface WalletTraceResponse {
  wallet: string
  destinations: TransferDestination[]
  totalSolTransferred: number
  txScanned: number
  error?: string
}

// ── Main handler ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const wallet = searchParams.get('address') ?? ''

  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
  }

  try {
    // Phase 1: Get recent signatures (last 200 transactions)
    const sigLimit = 200
    const sigs = await getSignatures(wallet, sigLimit)
    const validSigs = sigs.filter(s => !s.err && s.blockTime !== null)

    console.log(`[wallet-trace] ${wallet.slice(0, 8)}... — ${validSigs.length} txs to scan`)

    // Phase 2: Fetch transactions and detect outgoing SOL transfers
    const destinationMap = new Map<string, {
      totalLamports: number
      count: number
      lastAt: number
    }>()

    let txScanned = 0

    for (let i = 0; i < validSigs.length; i++) {
      const sig = validSigs[i]
      try {
        const resp = await rpcCall<{ result: ParsedTxResult | null }>({
          jsonrpc: '2.0', id: 1,
          method: 'getTransaction',
          params: [sig.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
        })

        const tx = resp.result
        if (!tx || !tx.meta || tx.meta.err !== null) continue
        txScanned++

        const keys = tx.transaction?.message?.accountKeys ?? []
        const walletIdx = keys.findIndex(k =>
          typeof k === 'string' ? k === wallet : k.pubkey === wallet
        )
        if (walletIdx === -1) continue

        // Check if wallet's SOL decreased
        const preSol = tx.meta.preBalances[walletIdx] ?? 0
        const postSol = tx.meta.postBalances[walletIdx] ?? 0
        const solDecrease = preSol - postSol
        // Must have sent at least 0.05 SOL (skip fee-only txs)
        if (solDecrease < 50_000_000) continue

        // Detect if this is a SWAP (has token balance changes for our wallet)
        // If so, SOL went to AMM/program, not to a user — skip
        const preTok = tx.meta.preTokenBalances ?? []
        const postTok = tx.meta.postTokenBalances ?? []
        const walletTokenChanges = postTok.some(pt => {
          if ((pt.owner ?? '') !== wallet) return false
          const pre = preTok.find(p => p.mint === pt.mint && (p.owner ?? '') === wallet)
          const preAmt = pre?.uiTokenAmount.uiAmount ?? 0
          const postAmt = pt.uiTokenAmount.uiAmount ?? 0
          return Math.abs(postAmt - preAmt) > 0
        })
        // Also check if tokens disappeared (sell)
        const walletTokenSold = preTok.some(pt => {
          if ((pt.owner ?? '') !== wallet) return false
          const post = postTok.find(p => p.mint === pt.mint && (p.owner ?? '') === wallet)
          const preAmt = pt.uiTokenAmount.uiAmount ?? 0
          const postAmt = post?.uiTokenAmount.uiAmount ?? 0
          return preAmt > 0 && postAmt < preAmt
        })

        if (walletTokenChanges || walletTokenSold) continue // This is a swap, not a transfer

        // Pure SOL transfer — find which accounts GAINED SOL
        for (let ai = 0; ai < keys.length; ai++) {
          if (ai === walletIdx) continue
          const pre = tx.meta.preBalances[ai] ?? 0
          const post = tx.meta.postBalances[ai] ?? 0
          const gained = post - pre
          if (gained < 10_000_000) continue // min 0.01 SOL

          const keyEntry = keys[ai]
          const addr: string = typeof keyEntry === 'string' ? keyEntry : keyEntry.pubkey
          if (addr === wallet) continue
          if (isFilteredAddress(addr)) continue

          const existing = destinationMap.get(addr) ?? { totalLamports: 0, count: 0, lastAt: 0 }
          existing.totalLamports += gained
          existing.count++
          existing.lastAt = Math.max(existing.lastAt, sig.blockTime ?? 0)
          destinationMap.set(addr, existing)
        }
      } catch (e) {
        console.warn(`[wallet-trace] tx error: ${(e as Error).message}`)
      }

      // Rate limiting: ~9 req/s for Helius
      if (i + 1 < validSigs.length) await sleep(110)
    }

    // Phase 3: Sort by total SOL received, take top candidates
    const candidates = [...destinationMap.entries()]
      .map(([addr, data]) => ({
        address: addr,
        totalSolReceived: Math.round((data.totalLamports / 1e9) * 1000) / 1000,
        transferCount: data.count,
        lastTransferAt: data.lastAt,
        currentSolBalance: 0,
      }))
      .sort((a, b) => b.totalSolReceived - a.totalSolReceived)
      .slice(0, 20) // take more, will filter down after account check

    // Phase 4: getAccountInfo for each candidate — filter out non-user wallets
    // Real user wallets are owned by System Program and not executable.
    // PDAs, vaults, fee accounts are owned by other programs.
    const SYSTEM_PROGRAM = '11111111111111111111111111111111'
    const sorted: typeof candidates = []

    for (let i = 0; i < candidates.length; i++) {
      try {
        const resp = await rpcCall<{ result: {
          value: {
            lamports: number
            owner: string
            executable: boolean
          } | null
        } }>({
          jsonrpc: '2.0', id: 1,
          method: 'getAccountInfo',
          params: [candidates[i].address, { encoding: 'base64', commitment: 'confirmed' }],
        })

        const acct = resp.result?.value
        if (!acct) {
          // Account doesn't exist (closed) — skip
          continue
        }

        // Filter: only keep wallets owned by System Program and not executable
        if (acct.executable || acct.owner !== SYSTEM_PROGRAM) {
          console.log(`[wallet-trace] filtered ${candidates[i].address.slice(0, 8)}... (owner=${acct.owner.slice(0, 8)}, exec=${acct.executable})`)
          continue
        }

        candidates[i].currentSolBalance = Math.round((acct.lamports / 1e9) * 1000) / 1000
        sorted.push(candidates[i])

        if (sorted.length >= 10) break
      } catch { /* skip */ }
      if (i + 1 < candidates.length) await sleep(100)
    }

    const totalSolTransferred = sorted.reduce((s, d) => s + d.totalSolReceived, 0)

    console.log(`[wallet-trace] ${wallet.slice(0, 8)}... — ${sorted.length} destinations, ${totalSolTransferred.toFixed(2)} SOL total transferred`)

    return NextResponse.json({
      wallet,
      destinations: sorted,
      totalSolTransferred: Math.round(totalSolTransferred * 1000) / 1000,
      txScanned,
    } satisfies WalletTraceResponse)

  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error(`[wallet-trace] error:`, msg)
    return NextResponse.json({
      wallet,
      destinations: [],
      totalSolTransferred: 0,
      txScanned: 0,
      error: msg,
    } satisfies WalletTraceResponse)
  }
}
