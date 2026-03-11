// lib/solanaRpcBackup.ts
// Oficjalny Solana JSON RPC — backup dla Helius gdy rate-limit (429)
// Darmowy, bez klucza

const SOLANA_RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
]

async function rpcCall(
  method: string,
  params: unknown[],
  endpointIndex = 0,
): Promise<unknown> {
  const endpoint = SOLANA_RPC_ENDPOINTS[endpointIndex]
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json() as { result?: unknown; error?: { message: string } }
    if (json.error) throw new Error(json.error.message)
    return json.result
  } catch (err) {
    if (endpointIndex < SOLANA_RPC_ENDPOINTS.length - 1) {
      return rpcCall(method, params, endpointIndex + 1)
    }
    console.error('[SolanaRpcBackup] All endpoints unavailable:', err)
    return null
  }
}

// Saldo SOL walletu (w SOL)
export async function getWalletSolBalance(walletAddress: string): Promise<number | null> {
  const result = await rpcCall('getBalance', [walletAddress]) as { value?: number } | null
  if (result?.value == null) return null
  return result.value / 1e9
}

// Lista tokenów SPL w wallecie
export async function getWalletTokenAccounts(walletAddress: string): Promise<Array<{
  mint: string
  amount: number
  decimals: number
  uiAmount: number
}> | null> {
  const result = await rpcCall('getTokenAccountsByOwner', [
    walletAddress,
    { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
    { encoding: 'jsonParsed' },
  ]) as { value?: Array<{ account?: { data?: { parsed?: { info?: Record<string, unknown> } } } }> } | null
  if (!result?.value) return null
  return result.value
    .map(acc => {
      const info = acc.account?.data?.parsed?.info
      const tokenAmount = info?.tokenAmount as Record<string, unknown> | undefined
      return {
        mint: (info?.mint as string) ?? '',
        amount: parseInt(String(tokenAmount?.amount ?? '0')),
        decimals: (tokenAmount?.decimals as number) ?? 0,
        uiAmount: (tokenAmount?.uiAmount as number) ?? 0,
      }
    })
    .filter(t => t.mint && t.uiAmount > 0)
}

// Ostatnie transakcje walletu
export async function getWalletRecentTransactions(
  walletAddress: string,
  limit = 20,
): Promise<Array<{ signature: string; slot: number; blockTime: number | null }> | null> {
  const result = await rpcCall('getSignaturesForAddress', [
    walletAddress,
    { limit },
  ]) as Array<{ signature: string; slot: number; blockTime: number | null }> | null
  if (!result) return null
  return result.map(tx => ({
    signature: tx.signature,
    slot: tx.slot,
    blockTime: tx.blockTime,
  }))
}

// Supply i decimals tokena
export async function getTokenInfo(mintAddress: string): Promise<{
  supply: number
  decimals: number
  isInitialized: boolean
} | null> {
  const result = await rpcCall('getTokenSupply', [mintAddress]) as {
    value?: { uiAmount?: number; decimals?: number }
  } | null
  if (!result?.value) return null
  return {
    supply: result.value.uiAmount ?? 0,
    decimals: result.value.decimals ?? 0,
    isInitialized: true,
  }
}
