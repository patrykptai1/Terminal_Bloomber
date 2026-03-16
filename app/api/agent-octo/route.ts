import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execFileAsync = promisify(execFile)

export async function POST(req: NextRequest) {
  try {
    const { userMessage } = await req.json()

    if (!userMessage || typeof userMessage !== 'string') {
      return NextResponse.json({ error: 'Brak wiadomości' }, { status: 400 })
    }

    const scriptPath = path.join(process.cwd(), 'lib', 'octotools', 'run_agent.py')

    const { stdout, stderr } = await execFileAsync(
      'python3',
      [scriptPath, userMessage],
      {
        timeout: 60_000,
        cwd: process.cwd(),
        env: {
          ...process.env,
          PYTHONPATH: process.cwd(),
        },
      }
    )

    if (stderr) {
      console.error('[agent-octo] stderr:', stderr)
    }

    const result = JSON.parse(stdout.trim())

    return NextResponse.json({
      message: result.answer ?? 'Brak odpowiedzi',
      trajectory: result.trajectory ?? [],
      steps_taken: result.steps_taken ?? 0,
      plan: result.global_plan ?? null,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[agent-octo] error:', msg)
    return NextResponse.json(
      { error: `Błąd agenta: ${msg}` },
      { status: 500 }
    )
  }
}
