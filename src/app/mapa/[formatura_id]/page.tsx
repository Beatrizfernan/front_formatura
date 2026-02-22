"use client"
import { useEffect, useState, useCallback, useRef } from "react"
import { useParams } from "next/navigation"
import { Loader2, AlertCircle, GripVertical, ArrowUpDown, Download, RotateCcw } from "lucide-react"
import { API_URL } from "@/app/layout"

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface FilaDetail { fila: string; assentos: number; range: string }
interface CourseDetail { curso: string; curso_id: string; abreviacao?: string; total_assentos: number; filas: FilaDetail[] }
interface EmptySeats { fila: string; assentos_vazios: number[]; total_vazios: number }
interface Segment { curso_id: string; nome: string; abrev: string; start: number; end: number; count: number; colorIdx: number }
interface RowData { nome: string; capacity: number; segments: Segment[] }

// ─── Paleta de cursos ─────────────────────────────────────────────────────────
const PALETTE = [
  { light: "#dbeafe", dark: "#3b82f6",  text: "#1e3a8a" },
  { light: "#d1fae5", dark: "#10b981",  text: "#064e3b" },
  { light: "#fef3c7", dark: "#f59e0b",  text: "#78350f" },
  { light: "#ede9fe", dark: "#8b5cf6",  text: "#4c1d95" },
  { light: "#ffe4e6", dark: "#f43f5e",  text: "#881337" },
  { light: "#cffafe", dark: "#06b6d4",  text: "#164e63" },
  { light: "#ffedd5", dark: "#f97316",  text: "#7c2d12" },
  { light: "#fce7f3", dark: "#ec4899",  text: "#831843" },
  { light: "#ecfccb", dark: "#65a30d",  text: "#365314" },
  { light: "#ede9fe", dark: "#7c3aed",  text: "#3b0764" },
  { light: "#ccfbf1", dark: "#14b8a6",  text: "#134e4a" },
  { light: "#fee2e2", dark: "#ef4444",  text: "#7f1d1d" },
  { light: "#e0e7ff", dark: "#6366f1",  text: "#1e1b4b" },
  { light: "#e0f2fe", dark: "#0ea5e9",  text: "#0c4a6e" },
]

const LINHA_CORREDOR = 12

function buildColorIndex(detalhes: CourseDetail[]): Record<string, number> {
  const map: Record<string, number> = {}
  detalhes.forEach((d, i) => { map[d.curso_id] = i % PALETTE.length })
  return map
}

function buildRowMap(detalhes: CourseDetail[], vazios: EmptySeats[], colorIndex: Record<string, number>): Map<string, RowData> {
  const raw = new Map<string, Map<number, string>>()
  const caps = new Map<string, number>()
  detalhes.forEach((d) => {
    d.filas.forEach((f) => {
      const [s, e] = f.range.includes("-") ? f.range.split("-").map(Number) : [+f.range, +f.range]
      if (!raw.has(f.fila)) raw.set(f.fila, new Map())
      for (let n = s; n <= e; n++) raw.get(f.fila)!.set(n, d.curso_id)
      caps.set(f.fila, Math.max(caps.get(f.fila) || 0, e))
    })
  })
  vazios.forEach((v) => {
    if (!raw.has(v.fila)) raw.set(v.fila, new Map())
    const max = v.assentos_vazios.length ? Math.max(...v.assentos_vazios) : 0
    caps.set(v.fila, Math.max(caps.get(v.fila) || 0, max))
  })
  const infoMap: Record<string, CourseDetail> = {}
  detalhes.forEach((d) => { infoMap[d.curso_id] = d })
  const result = new Map<string, RowData>()
  raw.forEach((assentos, nome) => {
    const cap = caps.get(nome) || 0
    const segments: Segment[] = []
    let cur: string | null = null, start = 0
    for (let n = 1; n <= cap; n++) {
      const c = assentos.get(n) || "__empty__"
      if (c !== cur) {
        if (cur && cur !== "__empty__") {
          const d = infoMap[cur]
          segments.push({ curso_id: cur, nome: d?.curso || cur, abrev: d?.abreviacao || (d?.curso || cur).slice(0, 6).toUpperCase(), start, end: n - 1, count: n - 1 - start + 1, colorIdx: colorIndex[cur] ?? 0 })
        }
        cur = c; start = n
      }
    }
    if (cur && cur !== "__empty__" && cap >= start) {
      const d = infoMap[cur]
      segments.push({ curso_id: cur, nome: d?.curso || cur, abrev: d?.abreviacao || (d?.curso || cur).slice(0, 6).toUpperCase(), start, end: cap, count: cap - start + 1, colorIdx: colorIndex[cur] ?? 0 })
    }
    result.set(nome, { nome, capacity: cap, segments })
  })
  return result
}

function groupRows(rowMap: Map<string, RowData>) {
  const before = new Map<number, RowData[]>()
  const after  = new Map<number, RowData[]>()
  rowMap.forEach((row) => {
    const m = row.nome.match(/^(\d+)([A-Z]+)$/)
    if (!m) return
    const num = parseInt(m[1])
    const tgt = num <= LINHA_CORREDOR ? before : after
    if (!tgt.has(num)) tgt.set(num, [])
    tgt.get(num)!.push(row)
  })
  const sort = (m: Map<number, RowData[]>) =>
    Array.from(m.entries()).sort(([a], [b]) => a - b).map(([num, rows]) => ({
      num, rows: rows.sort((a, b) => (a.nome.match(/[A-Z]+$/)?.[0] || "").localeCompare(b.nome.match(/[A-Z]+$/)?.[0] || ""))
    }))
  return { before: sort(before), after: sort(after) }
}

// ─── FilaBanco ────────────────────────────────────────────────────────────────
function calcFontSize(text: string, maxWidth: number, bold: boolean, maxPt = 10, minPt = 5): number {
  if (typeof window === "undefined") return 8
  const ctx = document.createElement("canvas").getContext("2d")!
  for (let pt = maxPt; pt >= minPt; pt--) {
    ctx.font = `${bold ? "bold " : ""}${pt}px sans-serif`
    if (ctx.measureText(text).width <= maxWidth) return pt
  }
  return minPt
}

function SegmentCell({ seg, widthPct, totalW, highlighted }: {
  seg: Segment; widthPct: number; totalW: number; highlighted: string | null
}) {
  const pal = PALETTE[seg.colorIdx]
  const isHL = highlighted === seg.curso_id
  const segW = (widthPct / 100) * totalW
  const PAD = 4
  const availW = Math.max(segW - PAD * 2, 1)
  const fzAbrev = typeof window !== "undefined" ? calcFontSize(seg.abrev, availW, true, 10, 5) : 8
  const qtdTxt  = `${seg.count} lug`
  const fzQtd   = typeof window !== "undefined" ? calcFontSize(qtdTxt, availW, false, Math.max(fzAbrev - 1, 4), 4) : 6
  const bg = isHL ? pal.dark : pal.light
  const fg = isHL ? "#ffffff" : pal.text
  return (
    <div
      style={{
        width: `${widthPct}%`,
        backgroundColor: bg,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
        paddingLeft: `${PAD}px`,
        paddingRight: `${PAD}px`,
        transition: "background-color 0.15s",
        borderRight: "1px solid rgba(255,255,255,0.4)",
        boxSizing: "border-box",
      }}
      title={`${seg.nome} — ${seg.count} assentos (${seg.start}–${seg.end})`}
    >
      {widthPct > 3 && (
        <>
          <span style={{ fontSize: `${fzAbrev}px`, fontWeight: "bold", color: fg, lineHeight: 1.1, whiteSpace: "nowrap", display: "block" }}>
            {seg.abrev}
          </span>
          {widthPct > 6 && (
            <span style={{ fontSize: `${fzQtd}px`, color: isHL ? "rgba(255,255,255,0.85)" : pal.text, lineHeight: 1.1, whiteSpace: "nowrap", display: "block", opacity: 0.85 }}>
              {qtdTxt}
            </span>
          )}
        </>
      )}
    </div>
  )
}

function FilaBanco({ row, highlighted, containerW }: { row: RowData; highlighted: string | null; containerW: number }) {
  const hasCourse = highlighted ? row.segments.some(s => s.curso_id === highlighted) : false
  const isDimmed  = highlighted !== null && !hasCourse
  const total     = row.capacity || 1
  return (
    <div style={{ opacity: isDimmed ? 0.2 : 1, transition: "opacity 0.15s" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "2px" }}>
        <span style={{ fontSize: "10px", fontWeight: "bold", color: "#475569", width: "44px", textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{row.nome}</span>
        <span style={{ fontSize: "9px", color: "#94a3b8" }}>{row.capacity} lug</span>
      </div>
      <div style={{ display: "flex", height: "28px", borderRadius: "6px", overflow: "hidden", border: "1px solid #e2e8f0", marginLeft: "48px", backgroundColor: "#f8fafc" }}>
        {row.segments.map((seg, i) => {
          const pct = (seg.count / total) * 100
          return (
            <SegmentCell key={i} seg={seg} widthPct={pct} totalW={containerW - 48} highlighted={highlighted} />
          )
        })}
      </div>
    </div>
  )
}

function Secao({ linhas, highlighted, containerW }: { linhas: { num: number; rows: RowData[] }[]; highlighted: string | null; containerW: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {linhas.map(({ num, rows }) => (
        <div key={num} style={{ display: "flex", gap: "12px" }}>
          {rows.map((row) => (
            <div key={row.nome} style={{ flex: 1, minWidth: 0 }}>
              <FilaBanco row={row} highlighted={highlighted} containerW={containerW / rows.length} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Legenda drag-and-drop ────────────────────────────────────────────────────
function LegendaDnD({ detalhes, colorIndex, highlighted, onHighlight, onReorder, loading }: {
  detalhes: CourseDetail[]; colorIndex: Record<string, number>; highlighted: string | null
  onHighlight: (id: string | null) => void; onReorder: (ids: string[]) => void; loading: boolean
}) {
  const [items, setItems] = useState<CourseDetail[]>(detalhes)
  const draggingIdx = useRef<number | null>(null)
  useEffect(() => { setItems(detalhes) }, [detalhes])

  const onDragStart = (i: number) => { draggingIdx.current = i }
  const onDragEnter = (i: number) => {
    if (draggingIdx.current === null || draggingIdx.current === i) return
    const next = [...items]
    const [moved] = next.splice(draggingIdx.current, 1)
    next.splice(i, 0, moved)
    draggingIdx.current = i
    setItems(next)
  }
  const onDragEnd = () => {
    draggingIdx.current = null
    onReorder(items.map(d => d.curso_id))
  }

  return (
    <aside style={{ width: "240px", flexShrink: 0 }}>
      <div style={{ position: "sticky", top: "57px", borderRadius: "12px", overflow: "hidden", border: "1px solid #e2e8f0", background: "white", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: "13px", fontWeight: "700", color: "#1e293b", lineHeight: 1.2 }}>Cursos</h2>
            <p style={{ fontSize: "10px", color: "#94a3b8", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
              <ArrowUpDown style={{ width: "10px", height: "10px" }} />
              Arraste para reordenar
            </p>
          </div>
          {loading && <Loader2 style={{ width: "14px", height: "14px", color: "#64748b" }} className="animate-spin" />}
        </div>
        <div style={{ maxHeight: "calc(100vh - 200px)", overflowY: "auto" }}>
          {items.map((d, i) => {
            const ci  = colorIndex[d.curso_id] ?? i % PALETTE.length
            const pal = PALETTE[ci]
            const isHL = highlighted === d.curso_id
            return (
              <div
                key={d.curso_id}
                draggable
                onDragStart={() => onDragStart(i)}
                onDragEnter={() => onDragEnter(i)}
                onDragEnd={onDragEnd}
                onDragOver={e => e.preventDefault()}
                onMouseEnter={() => onHighlight(d.curso_id)}
                onMouseLeave={() => onHighlight(null)}
                style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "10px 12px",
                  cursor: loading ? "not-allowed" : "grab",
                  background: isHL ? "#f1f5f9" : "transparent",
                  borderBottom: "1px solid #f8fafc",
                  pointerEvents: loading ? "none" : "auto",
                  opacity: loading ? 0.5 : 1,
                  transition: "background 0.12s",
                  userSelect: "none",
                }}
              >
                <GripVertical style={{ width: "14px", height: "14px", color: "#cbd5e1", flexShrink: 0 }} />
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: pal.dark, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "11px", fontWeight: "600", color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.curso}</p>
                  <p style={{ fontSize: "10px", color: "#94a3b8", fontVariantNumeric: "tabular-nums" }}>{d.total_assentos} assentos</p>
                </div>
                <span style={{ fontSize: "10px", color: "#cbd5e1", fontFamily: "monospace", flexShrink: 0 }}>#{i + 1}</span>
              </div>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function MapaPage() {
  const params = useParams()
  const formaturaId = params?.formatura_id as string

  const [detalhes, setDetalhes]             = useState<CourseDetail[]>([])
  const [nomeFormatura, setNomeFormatura]   = useState("")
  const [colorIndex, setColorIndex]         = useState<Record<string, number>>({})
  const [rowMap, setRowMap]                 = useState(new Map<string, RowData>())
  const [highlighted, setHighlighted]       = useState<string | null>(null)
  const [loadingPage, setLoadingPage]       = useState(true)
  const [loadingReorder, setLoadingReorder] = useState(false)
  const [loadingPdf, setLoadingPdf]         = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const [containerW, setContainerW]         = useState(900)
  const mainRef = useRef<HTMLDivElement>(null)
  const ordemOriginal = useRef<string[]>([])

  const aplicar = useCallback((nd: CourseDetail[], nv: EmptySeats[]) => {
    const idx = buildColorIndex(nd)
    setColorIndex(idx)
    setDetalhes(nd)
    setRowMap(buildRowMap(nd, nv, idx))
  }, [])

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      if (entries[0]) setContainerW(entries[0].contentRect.width)
    })
    if (mainRef.current) obs.observe(mainRef.current)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!formaturaId) return
    fetch(`${API_URL}/api/alocacao/${formaturaId}`)
      .then(r => r.json())
      .then(data => {
        setNomeFormatura(data.formatura?.nome || "")
        aplicar(data.alocacao.detalhes, data.alocacao.assentos_vazios || [])
        if (ordemOriginal.current.length === 0)
          ordemOriginal.current = data.alocacao.detalhes.map((d: CourseDetail) => d.curso_id)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoadingPage(false))
  }, [formaturaId, aplicar])

  const handleReorder = useCallback(async (novaOrdem: string[]) => {
    setLoadingReorder(true); setError(null)
    try {
      const res = await fetch(`${API_URL}/api/alocacao/${formaturaId}/reordenar`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordem: novaOrdem }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao reordenar")
      aplicar(data.alocacao.detalhes, data.alocacao.assentos_vazios || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao reordenar")
      setTimeout(() => setError(null), 6000)
    } finally { setLoadingReorder(false) }
  }, [formaturaId, aplicar])

  const handleReset = useCallback(() => {
    if (ordemOriginal.current.length > 0) handleReorder(ordemOriginal.current)
  }, [handleReorder])

  const handleDownload = useCallback(async () => {
    setLoadingPdf(true)
    try {
      const response = await fetch(`${API_URL}/api/pdf/mapa-assentos/${formaturaId}`, {
        method: "GET", headers: { Accept: "application/pdf" },
      })
      if (!response.ok) { const err = await response.json(); throw new Error(err.error || "Erro PDF") }
      const blob = await response.blob()
      const url  = window.URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href = url
      a.download = `mapa-assentos-${nomeFormatura.replace(/\s+/g, "-")}.pdf`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar PDF")
      setTimeout(() => setError(null), 5000)
    } finally { setLoadingPdf(false) }
  }, [formaturaId, nomeFormatura])

  const { before, after } = groupRows(rowMap)

  if (loadingPage) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
        <Loader2 style={{ width: "32px", height: "32px", color: "#94a3b8" }} className="animate-spin" />
        <p style={{ fontSize: "14px", color: "#64748b" }}>Carregando mapa...</p>
      </div>
    </div>
  )

  if (error && detalhes.length === 0) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: "32px" }}>
      <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "12px", padding: "24px", maxWidth: "480px", display: "flex", gap: "12px" }}>
        <AlertCircle style={{ width: "20px", height: "20px", color: "#e11d48", flexShrink: 0 }} />
        <p style={{ fontSize: "14px", color: "#be123c" }}>{error}</p>
      </div>
    </div>
  )

  const busy = loadingReorder || loadingPdf

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      {/* Topbar */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #e2e8f0",
        padding: "10px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#3b82f6", flexShrink: 0 }} />
          <h1 style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nomeFormatura}</h1>
          <span style={{ color: "#cbd5e1", fontSize: "12px" }}>•</span>
          <span style={{ fontSize: "12px", color: "#64748b" }}>Mapa de Assentos</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {(busy || error) && (
            <div style={{
              display: "flex", alignItems: "center", gap: "6px", fontSize: "12px",
              padding: "6px 12px", borderRadius: "20px",
              background: busy ? "#f8fafc" : "#fff1f2",
              color: busy ? "#475569" : "#be123c",
              border: busy ? "1px solid #e2e8f0" : "1px solid #fecdd3"
            }}>
              {busy && <Loader2 style={{ width: "12px", height: "12px" }} className="animate-spin" />}
              {loadingReorder ? "Reordenando..." : loadingPdf ? "Gerando PDF..." : error}
            </div>
          )}
          {/* Reset */}
          <button
            onClick={handleReset}
            disabled={busy}
            title="Voltar à ordem original da planilha"
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "6px 14px", fontSize: "12px", fontWeight: "600",
              color: "#475569", background: "white",
              border: "1px solid #e2e8f0", borderRadius: "8px",
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.5 : 1, transition: "all 0.15s"
            }}
          >
            <RotateCcw style={{ width: "13px", height: "13px" }} />
            Resetar
          </button>
          {/* Exportar PDF */}
          <button
            onClick={handleDownload}
            disabled={busy}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "6px 16px", fontSize: "12px", fontWeight: "700",
              color: "white",
              background: busy ? "#93c5fd" : "#3b82f6",
              border: "none", borderRadius: "8px",
              cursor: busy ? "not-allowed" : "pointer",
              boxShadow: busy ? "none" : "0 2px 8px rgba(59,130,246,0.35)",
              transition: "all 0.15s"
            }}
          >
            <Download style={{ width: "13px", height: "13px" }} />
            Exportar PDF
          </button>
        </div>
      </header>

      {/* Layout */}
      <div style={{ display: "flex", gap: "20px", padding: "20px", maxWidth: "1600px", margin: "0 auto" }}>
        <LegendaDnD
          detalhes={detalhes}
          colorIndex={colorIndex}
          highlighted={highlighted}
          onHighlight={setHighlighted}
          onReorder={handleReorder}
          loading={loadingReorder}
        />
        <main
          ref={mainRef}
          style={{
            flex: 1, minWidth: 0,
            display: "flex", flexDirection: "column", gap: "20px",
            opacity: loadingReorder ? 0.3 : 1,
            pointerEvents: loadingReorder ? "none" : "auto",
            transition: "opacity 0.3s"
          }}
        >
          {/* Palco */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{
              background: "#1e293b",
              color: "white",
              padding: "10px 64px", borderRadius: "10px",
              fontSize: "14px", fontWeight: "800", letterSpacing: "0.15em",
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)"
            }}>
              🎭 PALCO 🎭
            </div>
          </div>

          <Secao linhas={before} highlighted={highlighted} containerW={containerW} />

          {after.length > 0 && (
            <>
              <div style={{
                background: "#334155",
                color: "#e2e8f0",
                textAlign: "center", padding: "6px 0", borderRadius: "8px",
                fontSize: "11px", fontWeight: "700", letterSpacing: "0.15em",
                boxShadow: "0 2px 6px rgba(0,0,0,0.1)"
              }}>
                ══ CORREDOR ══
              </div>
              <Secao linhas={after} highlighted={highlighted} containerW={containerW} />
            </>
          )}
        </main>
      </div>
    </div>
  )
}