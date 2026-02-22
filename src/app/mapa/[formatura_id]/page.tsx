"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams } from "next/navigation"
import { Loader2, AlertCircle, GripVertical, ArrowUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { API_URL } from "@/app/layout"

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

interface FilaDetail {
  fila: string
  assentos: number
  range: string
}

interface CourseDetail {
  curso: string
  curso_id: string
  abreviacao?: string
  total_assentos: number
  filas: FilaDetail[]
}

interface EmptySeats {
  fila: string
  assentos_vazios: number[]
  total_vazios: number
}

interface Segment {
  curso_id: string
  nome: string
  abrev: string
  start: number
  end: number
  count: number
  colorIdx: number
}

interface RowData {
  nome: string
  capacity: number
  segments: Segment[]
}

// ─────────────────────────────────────────────
// Paleta de cores
// ─────────────────────────────────────────────

const PALETTE = [
  { light: "bg-blue-100",    dark: "bg-blue-500",    text: "text-blue-900",    border: "border-blue-300",    hex: "#3b82f6" },
  { light: "bg-emerald-100", dark: "bg-emerald-500", text: "text-emerald-900", border: "border-emerald-300", hex: "#10b981" },
  { light: "bg-amber-100",   dark: "bg-amber-500",   text: "text-amber-900",   border: "border-amber-300",   hex: "#f59e0b" },
  { light: "bg-purple-100",  dark: "bg-purple-500",  text: "text-purple-900",  border: "border-purple-300",  hex: "#a855f7" },
  { light: "bg-rose-100",    dark: "bg-rose-500",    text: "text-rose-900",    border: "border-rose-300",    hex: "#f43f5e" },
  { light: "bg-cyan-100",    dark: "bg-cyan-500",    text: "text-cyan-900",    border: "border-cyan-300",    hex: "#06b6d4" },
  { light: "bg-orange-100",  dark: "bg-orange-500",  text: "text-orange-900",  border: "border-orange-300",  hex: "#f97316" },
  { light: "bg-pink-100",    dark: "bg-pink-500",    text: "text-pink-900",    border: "border-pink-300",    hex: "#ec4899" },
  { light: "bg-lime-100",    dark: "bg-lime-600",    text: "text-lime-900",    border: "border-lime-300",    hex: "#65a30d" },
  { light: "bg-violet-100",  dark: "bg-violet-500",  text: "text-violet-900",  border: "border-violet-300",  hex: "#8b5cf6" },
  { light: "bg-teal-100",    dark: "bg-teal-500",    text: "text-teal-900",    border: "border-teal-300",    hex: "#14b8a6" },
  { light: "bg-red-100",     dark: "bg-red-500",     text: "text-red-900",     border: "border-red-300",     hex: "#ef4444" },
  { light: "bg-indigo-100",  dark: "bg-indigo-500",  text: "text-indigo-900",  border: "border-indigo-300",  hex: "#6366f1" },
  { light: "bg-sky-100",     dark: "bg-sky-500",     text: "text-sky-900",     border: "border-sky-300",     hex: "#0ea5e9" },
]

const LINHA_CORREDOR = 12

// ─────────────────────────────────────────────
// Processamento de dados
// ─────────────────────────────────────────────

function buildColorIndex(detalhes: CourseDetail[]) {
  const map: Record<string, number> = {}
  detalhes.forEach((d, i) => { map[d.curso_id] = i % PALETTE.length })
  return map
}

function buildRowMap(
  detalhes: CourseDetail[],
  vazios: EmptySeats[],
  colorIndex: Record<string, number>
): Map<string, RowData> {
  const raw = new Map<string, Map<number, string>>()
  const capacities = new Map<string, number>()

  detalhes.forEach((d) => {
    d.filas.forEach((f) => {
      const [s, e] = f.range.includes("-")
        ? f.range.split("-").map(Number)
        : [+f.range, +f.range]
      if (!raw.has(f.fila)) raw.set(f.fila, new Map())
      const row = raw.get(f.fila)!
      for (let n = s; n <= e; n++) row.set(n, d.curso_id)
      capacities.set(f.fila, Math.max(capacities.get(f.fila) || 0, e))
    })
  })

  vazios.forEach((v) => {
    if (!raw.has(v.fila)) raw.set(v.fila, new Map())
    const max = v.assentos_vazios.length ? Math.max(...v.assentos_vazios) : 0
    capacities.set(v.fila, Math.max(capacities.get(v.fila) || 0, max))
  })

  const infoMap: Record<string, CourseDetail> = {}
  detalhes.forEach((d) => { infoMap[d.curso_id] = d })

  const result = new Map<string, RowData>()
  raw.forEach((assentos, nome) => {
    const cap = capacities.get(nome) || 0
    const segments: Segment[] = []

    let cur: string | null = null
    let start = 0
    for (let n = 1; n <= cap; n++) {
      const c = assentos.get(n) || "__empty__"
      if (c !== cur) {
        if (cur && cur !== "__empty__") {
          const d = infoMap[cur]
          segments.push({
            curso_id: cur,
            nome: d?.curso || cur,
            abrev: d?.abreviacao || (d?.curso || cur).substring(0, 6).toUpperCase(),
            start, end: n - 1,
            count: n - 1 - start + 1,
            colorIdx: colorIndex[cur] ?? 0,
          })
        }
        cur = c
        start = n
      }
    }
    if (cur && cur !== "__empty__" && cap >= start) {
      const d = infoMap[cur]
      segments.push({
        curso_id: cur,
        nome: d?.curso || cur,
        abrev: d?.abreviacao || (d?.curso || cur).substring(0, 6).toUpperCase(),
        start, end: cap,
        count: cap - start + 1,
        colorIdx: colorIndex[cur] ?? 0,
      })
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
    const target = num <= LINHA_CORREDOR ? before : after
    if (!target.has(num)) target.set(num, [])
    target.get(num)!.push(row)
  })

  const sort = (m: Map<number, RowData[]>) =>
    Array.from(m.entries())
      .sort(([a], [b]) => a - b)
      .map(([num, rows]) => ({
        num,
        rows: rows.sort((a, b) => {
          const la = a.nome.match(/[A-Z]+$/)?.[0] || ""
          const lb = b.nome.match(/[A-Z]+$/)?.[0] || ""
          return la.localeCompare(lb)
        }),
      }))

  return { before: sort(before), after: sort(after) }
}

// ─────────────────────────────────────────────
// Componente: banco visual (uma fila)
// ─────────────────────────────────────────────

function FilaBanco({ row, highlighted }: { row: RowData; highlighted: string | null }) {
  const hasCourse = highlighted
    ? row.segments.some((s) => s.curso_id === highlighted)
    : false
  const isDimmed = highlighted !== null && !hasCourse

  return (
    <div className={cn("transition-opacity duration-150", isDimmed && "opacity-20")}>
      {/* Label */}
      <div className="flex items-baseline gap-1 mb-0.5">
        <span className="text-[10px] font-bold text-gray-500 w-10 text-right flex-shrink-0 tabular-nums">
          {row.nome}
        </span>
        <span className="text-[9px] text-gray-300 leading-none">{row.capacity}lug</span>
      </div>

      {/* Barra proporcional */}
      <div className="flex h-6 rounded overflow-hidden border border-gray-200 gap-[1px] bg-gray-100 ml-11">
        {row.segments.map((seg, i) => {
          const pct = (seg.count / row.capacity) * 100
          const pal = PALETTE[seg.colorIdx]
          const isHL = highlighted === seg.curso_id

          return (
            <div
              key={i}
              style={{ width: `${pct}%` }}
              title={`${seg.nome} — ${seg.count} assentos (${seg.start}–${seg.end})`}
              className={cn(
                "flex items-center justify-center overflow-hidden transition-colors duration-150 min-w-0",
                isHL
                  ? cn(pal.dark, "text-white")
                  : cn(pal.light, pal.text)
              )}
            >
              {pct > 7 && (
                <span className="text-[8px] font-bold truncate px-0.5 leading-none pointer-events-none">
                  {pct > 16 ? seg.abrev : seg.abrev.slice(0, 3)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Componente: seção (conjunto de linhas)
// ─────────────────────────────────────────────

function Secao({
  linhas,
  highlighted,
}: {
  linhas: { num: number; rows: RowData[] }[]
  highlighted: string | null
}) {
  return (
    <div className="space-y-1">
      {linhas.map(({ num, rows }) => (
        <div key={num} className="flex gap-3">
          {rows.map((row) => (
            <div key={row.nome} className="flex-1 min-w-0">
              <FilaBanco row={row} highlighted={highlighted} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// Componente: Legenda drag-and-drop
// ─────────────────────────────────────────────

function LegendaDnD({
  detalhes,
  colorIndex,
  highlighted,
  onHighlight,
  onReorder,
  loading,
}: {
  detalhes: CourseDetail[]
  colorIndex: Record<string, number>
  highlighted: string | null
  onHighlight: (id: string | null) => void
  onReorder: (ids: string[]) => void
  loading: boolean
}) {
  const [items, setItems] = useState<CourseDetail[]>(detalhes)
  const draggingIdx = useRef<number | null>(null)

  // Sincroniza quando resposta do servidor volta
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
    onReorder(items.map((d) => d.curso_id))
  }

  return (
    <aside className="w-60 flex-shrink-0">
      <div className="sticky top-[57px] rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 leading-tight">Cursos</h2>
            <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
              <ArrowUpDown className="h-2.5 w-2.5" />
              Arraste para reordenar
            </p>
          </div>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />}
        </div>

        {/* Items */}
        <div className="divide-y divide-gray-50 max-h-[calc(100vh-130px)] overflow-y-auto">
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
                onDragOver={(e) => e.preventDefault()}
                onMouseEnter={() => onHighlight(d.curso_id)}
                onMouseLeave={() => onHighlight(null)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 cursor-grab active:cursor-grabbing select-none transition-colors group",
                  isHL ? pal.light : "hover:bg-gray-50",
                  loading && "pointer-events-none opacity-50"
                )}
              >
                <GripVertical className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-400 flex-shrink-0 transition-colors" />

                {/* Bolinha cor */}
                <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", pal.dark)} />

                {/* Nome + qtd */}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-gray-800 truncate leading-tight">
                    {d.curso}
                  </p>
                  <p className="text-[10px] text-gray-400 leading-tight tabular-nums">
                    {d.total_assentos} assentos
                  </p>
                </div>

                {/* Número de ordem */}
                <span className="text-[10px] text-gray-300 font-mono flex-shrink-0">#{i + 1}</span>
              </div>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

// ─────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────

export default function MapaPage() {
  const params = useParams()
  const formaturaId = params?.formatura_id as string

  const [detalhes, setDetalhes]             = useState<CourseDetail[]>([])
  const [vazios, setVazios]                 = useState<EmptySeats[]>([])
  const [nomeFormatura, setNomeFormatura]   = useState("")
  const [colorIndex, setColorIndex]         = useState<Record<string, number>>({})
  const [rowMap, setRowMap]                 = useState(new Map<string, RowData>())

  const [highlighted, setHighlighted]       = useState<string | null>(null)
  const [loadingPage, setLoadingPage]       = useState(true)
  const [loadingReorder, setLoadingReorder] = useState(false)
  const [error, setError]                   = useState<string | null>(null)

  const aplicar = useCallback(
    (nd: CourseDetail[], nv: EmptySeats[], ci?: Record<string, number>) => {
      const idx = ci || buildColorIndex(nd)
      setColorIndex(idx)
      setDetalhes(nd)
      setVazios(nv)
      setRowMap(buildRowMap(nd, nv, idx))
    },
    []
  )

  // Carga inicial
  useEffect(() => {
    if (!formaturaId) return
    fetch(`${API_URL}/api/alocacao/${formaturaId}`)
      .then((r) => r.json())
      .then((data) => {
        setNomeFormatura(data.formatura?.nome || "")
        aplicar(data.alocacao.detalhes, data.alocacao.assentos_vazios || [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingPage(false))
  }, [formaturaId, aplicar])

  // Reordenação via legenda
  const handleReorder = useCallback(
    async (novaOrdem: string[]) => {
      setLoadingReorder(true)
      setError(null)
      try {
        const res = await fetch(`${API_URL}/api/alocacao/${formaturaId}/reordenar`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ordem: novaOrdem }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Erro ao reordenar")
        aplicar(data.alocacao.detalhes, data.alocacao.assentos_vazios || [], colorIndex)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao reordenar")
        setTimeout(() => setError(null), 6000)
      } finally {
        setLoadingReorder(false)
      }
    },
    [formaturaId, colorIndex, aplicar]
  )

  const { before, after } = groupRows(rowMap)

  // ── Loading ──
  if (loadingPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
          <p className="text-sm text-gray-400">Carregando mapa...</p>
        </div>
      </div>
    )
  }

  if (error && detalhes.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md flex gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    )
  }

  // ── Render ──
  return (
    <div className="min-h-screen bg-gray-50">

      {/* Topbar */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <h1 className="text-sm font-semibold text-gray-900 truncate">{nomeFormatura}</h1>
          <span className="text-gray-300 text-xs">•</span>
          <span className="text-xs text-gray-400">Mapa de Assentos</span>
        </div>

        {(loadingReorder || error) && (
          <div className={cn(
            "flex items-center gap-2 text-xs px-3 py-1.5 rounded-full",
            loadingReorder
              ? "text-blue-600 bg-blue-50"
              : "text-red-600 bg-red-50 border border-red-200"
          )}>
            {loadingReorder && <Loader2 className="h-3 w-3 animate-spin" />}
            {loadingReorder ? "Reordenando e salvando..." : error}
          </div>
        )}
      </header>

      {/* Layout */}
      <div className="flex gap-5 p-5 max-w-[1600px] mx-auto">

        {/* Legenda drag-and-drop */}
        <LegendaDnD
          detalhes={detalhes}
          colorIndex={colorIndex}
          highlighted={highlighted}
          onHighlight={setHighlighted}
          onReorder={handleReorder}
          loading={loadingReorder}
        />

        {/* Mapa */}
        <main
          className={cn(
            "flex-1 min-w-0 space-y-5 transition-opacity duration-300",
            loadingReorder && "opacity-30 pointer-events-none select-none"
          )}
        >
          {/* Palco */}
          <div className="flex justify-center">
            <div className="bg-gray-900 text-white px-16 py-2.5 rounded-lg text-sm font-bold tracking-widest">
              🎭 PALCO 🎭
            </div>
          </div>

          {/* Antes do corredor */}
          <Secao linhas={before} highlighted={highlighted} />

          {/* Corredor */}
          {after.length > 0 && (
            <>
              <div className="bg-gray-600 text-white text-center py-1.5 rounded-lg text-xs font-bold tracking-widest">
                ══ CORREDOR ══
              </div>
              <Secao linhas={after} highlighted={highlighted} />
            </>
          )}
        </main>
      </div>
    </div>
  )
}