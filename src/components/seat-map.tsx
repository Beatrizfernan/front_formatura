"use client"

import { useState, useMemo, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { Armchair, AlertCircle, RotateCcw, Loader2 } from "lucide-react"
import { API_URL } from "@/app/layout"

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface FilaDetail {
  fila: string
  assentos: number
  range: string
}

interface AllocationDetail {
  curso: string
  abreviacao?: string
  total_assentos: number
  filas: FilaDetail[]
}

interface AssentosVazios {
  fila: string
  assentos_vazios: number[]
  total_vazios: number
}

interface Seat {
  number: number
  curso: string     // nome do curso (usado para cor e seleção)
  cursoId: string   // ID do curso no banco (usado para chamar o backend)
  color: string
  isEmpty?: boolean
}

interface Row {
  name: string
  seats: (Seat | null)[]
  maxCapacity: number
}

// ---------------------------------------------------------------------------
// Cores
// ---------------------------------------------------------------------------

const COURSE_COLORS = [
  "bg-blue-500 hover:bg-blue-600",
  "bg-emerald-500 hover:bg-emerald-600",
  "bg-amber-500 hover:bg-amber-600",
  "bg-purple-500 hover:bg-purple-600",
  "bg-rose-500 hover:bg-rose-600",
  "bg-cyan-500 hover:bg-cyan-600",
  "bg-orange-500 hover:bg-orange-600",
  "bg-pink-500 hover:bg-pink-600",
]

// ---------------------------------------------------------------------------
// Inicializa o mapa de assentos a partir dos detalhes da alocação
// ---------------------------------------------------------------------------

function buildSeatMap(
  details: AllocationDetail[],
  assentosVazios: AssentosVazios[]
): {
  seatMap: Map<string, Map<number, Seat>>
  courseColors: Record<string, string>
  // map de nome do curso → ID do curso no banco
  courseIdMap: Record<string, string>
  filaCapacities: Map<string, number>
} {
  const seatMap = new Map<string, Map<number, Seat>>()
  const courseColors: Record<string, string> = {}
  const courseIdMap: Record<string, string> = {}
  const filaCapacities = new Map<string, number>()

  details.forEach((detail, index) => {
    courseColors[detail.curso] = COURSE_COLORS[index % COURSE_COLORS.length]
    // O campo abreviacao não é o ID — o backend retorna curso_id dentro de detalhes_filas
    // mas no resumo de detalhes não temos o ID diretamente.
    // Vamos guardar o nome como chave e buscar o ID via campo "curso_id" que adicionamos.
    // Por ora usamos o nome como fallback; veja nota abaixo.
  })

  // Determina capacidade de cada fila
  details.forEach((detail) => {
    detail.filas.forEach((fila) => {
      const parts = fila.range.split("-").map(Number)
      const end = parts.length === 2 ? parts[1] : parts[0]
      const cur = filaCapacities.get(fila.fila) || 0
      filaCapacities.set(fila.fila, Math.max(cur, end))
    })
  })

  assentosVazios.forEach((v) => {
    const maxEmpty = Math.max(...v.assentos_vazios)
    const cur = filaCapacities.get(v.fila) || 0
    filaCapacities.set(v.fila, Math.max(cur, maxEmpty))
  })

  // Preenche assentos dos cursos
  details.forEach((detail) => {
    detail.filas.forEach((fila) => {
      if (!seatMap.has(fila.fila)) seatMap.set(fila.fila, new Map())
      const row = seatMap.get(fila.fila)!
      const parts = fila.range.split("-").map(Number)
      const start = parts[0]
      const end = parts.length === 2 ? parts[1] : parts[0]

      for (let i = start; i <= end; i++) {
        row.set(i, {
          number: i,
          curso: detail.curso,
          // O backend retorna "curso_id" dentro do detail quando usamos o endpoint novo.
          // Para compatibilidade, usamos (detail as any).curso_id ?? detail.curso
          cursoId: (detail as any).curso_id ?? detail.curso,
          color: courseColors[detail.curso],
        })
      }
    })
  })

  // Preenche assentos vazios
  assentosVazios.forEach((v) => {
    if (!seatMap.has(v.fila)) seatMap.set(v.fila, new Map())
    const row = seatMap.get(v.fila)!
    v.assentos_vazios.forEach((n) => {
      row.set(n, { number: n, curso: "Vazio", cursoId: "", color: "bg-muted", isEmpty: true })
    })
  })

  return { seatMap, courseColors, courseIdMap, filaCapacities }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SeatMapProps {
  details: AllocationDetail[]
  assentosVazios?: AssentosVazios[]
  formaturaId: string
  onAlocacaoUpdate?: (novaAlocacao: { detalhes: AllocationDetail[]; assentos_vazios: AssentosVazios[] }) => void
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function SeatMapDragDrop({
  details,
  assentosVazios = [],
  formaturaId,
  onAlocacaoUpdate,
}: SeatMapProps) {
  const initialState = useMemo(
    () => buildSeatMap(details, assentosVazios),
    [details, assentosVazios]
  )

  const [seatMap, setSeatMap] = useState(initialState.seatMap)
  const [filaCapacities] = useState(initialState.filaCapacities)
  const courseColors = initialState.courseColors

  // Curso selecionado para mover: { nome, cursoId }
  const [selectedCourse, setSelectedCourse] = useState<{ nome: string; cursoId: string } | null>(null)
  const [hoveredSeat, setHoveredSeat] = useState<{ fila: string; seat: number } | null>(null)

  // Estado de loading enquanto aguarda resposta do backend
  const [loadingMove, setLoadingMove] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Quantidade de assentos por curso (para exibir na legenda e na dica)
  const courseSeats = useMemo(() => {
    const m: Record<string, number> = {}
    details.forEach((d) => { m[d.curso] = d.total_assentos })
    return m
  }, [details])

  // Agrupa filas em linhas para renderização
  const rowGroups = useMemo(() => {
    const rowsArray: Row[] = Array.from(seatMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, rowMap]) => {
        const maxCapacity = filaCapacities.get(name) || 0
        const seats: (Seat | null)[] = []
        for (let i = 1; i <= maxCapacity; i++) {
          seats.push(rowMap.get(i) || null)
        }
        return { name, seats, maxCapacity }
      })

    const grouped = new Map<string, Row[]>()
    rowsArray.forEach((row) => {
      const rowNumber = row.name.match(/^\d+/)?.[0] || row.name
      if (!grouped.has(rowNumber)) grouped.set(rowNumber, [])
      grouped.get(rowNumber)!.push(row)
    })

    return Array.from(grouped.entries())
      .sort(([a], [b]) => (parseInt(a) || 0) - (parseInt(b) || 0))
      .map(([, rows]) => rows)
  }, [seatMap, filaCapacities])

  // Clique numa cadeira de curso → seleciona aquele curso para mover
  const handleCourseClick = useCallback(
    (curso: string, cursoId: string) => {
      if (curso === "Vazio") return
      setSelectedCourse(
        selectedCourse?.nome === curso ? null : { nome: curso, cursoId }
      )
      setError(null)
    },
    [selectedCourse]
  )

  // Clique numa cadeira destino → chama o backend
  const handleSeatClick = useCallback(
    async (targetFila: string, targetSeatNumber: number) => {
      if (!selectedCourse) return

      setLoadingMove(true)
      setError(null)

      try {
        const res = await fetch(
          `${API_URL}/api/alocacao/${formaturaId}/mover-curso`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              curso_id: selectedCourse.cursoId,
              fila_destino: targetFila,
              assento_destino: targetSeatNumber,
            }),
          }
        )

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || "Erro ao mover curso")
        }

        // Reconstrói o mapa local com a resposta do backend
        const novaAlocacao = data.alocacao
        const novoState = buildSeatMap(novaAlocacao.detalhes, novaAlocacao.assentos_vazios ?? [])
        setSeatMap(novoState.seatMap)

        // Notifica a página pai para atualizar o estado global (ex: PDF)
        onAlocacaoUpdate?.({
          detalhes: novaAlocacao.detalhes,
          assentos_vazios: novaAlocacao.assentos_vazios ?? [],
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido")
        setTimeout(() => setError(null), 5000)
      } finally {
        setLoadingMove(false)
        setSelectedCourse(null)
        setHoveredSeat(null)
      }
    },
    [selectedCourse, formaturaId, onAlocacaoUpdate]
  )

  // Reset: volta ao estado inicial (antes de qualquer move)
  const handleReset = useCallback(() => {
    const newState = buildSeatMap(details, assentosVazios)
    setSeatMap(newState.seatMap)
    setSelectedCourse(null)
    setError(null)
  }, [details, assentosVazios])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6 w-full">
      {/* Erros */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading overlay suave */}
      {loadingMove && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Movendo curso, aguarde...
        </div>
      )}

      {/* Legenda + Reset */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2 md:gap-3 p-3 md:p-4 bg-muted/50 rounded-lg flex-1">
          {details.map((detail) => (
            <div key={detail.curso} className="flex items-center gap-1.5 md:gap-2">
              <div className={cn("w-3 h-3 md:w-4 md:h-4 rounded", courseColors[detail.curso]?.split(" ")[0])} />
              <span className="text-xs md:text-sm font-medium">{detail.curso}</span>
              <Badge variant="secondary" className="text-xs">
                {detail.total_assentos}
              </Badge>
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={handleReset} disabled={loadingMove}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>
      </div>

      {/* Instruções */}
      <div className="p-3 md:p-4 bg-blue-50 border border-blue-200 rounded-lg text-xs md:text-sm text-blue-900">
        <strong>Como usar:</strong> Clique em qualquer cadeira de uma turma para selecioná-la. Depois,
        clique na cadeira onde deseja começar a alocar a turma. A mudança é salva automaticamente.
      </div>

      {/* Palco */}
      <div className="flex justify-center">
        <div className="bg-muted px-6 md:px-8 py-1.5 md:py-2 rounded-t-lg border-2 border-b-0 border-border">
          <span className="text-xs md:text-sm font-semibold text-muted-foreground">PALCO</span>
        </div>
      </div>

      {/* Mapa de assentos */}
      <div className="overflow-x-auto pb-4 px-2">
        <div className="min-w-max space-y-6">
          {rowGroups.map((rowGroup, groupIndex) => (
            <div key={groupIndex} className="border-b border-border/50 pb-6 last:border-b-0">
              <div className="flex gap-6 md:gap-8 items-start justify-start">
                {rowGroup.map((row) => (
                  <div key={row.name} className="flex flex-col items-center space-y-2 md:space-y-3">
                    <Badge variant="outline" className="font-mono font-bold text-xs md:text-base">
                      Fila {row.name}
                    </Badge>

                    <div className="flex gap-1 md:gap-2">
                      {row.seats.map((seat, index) => {
                        const seatNumber = index + 1
                        const isSelected = selectedCourse !== null && seat?.curso === selectedCourse.nome
                        const isHovered =
                          hoveredSeat?.fila === row.name && hoveredSeat?.seat === seatNumber
                        const isOtherCourse =
                          selectedCourse !== null && seat && !seat.isEmpty && seat.curso !== selectedCourse.nome

                        if (!seat) {
                          return <div key={index} className="w-10 h-12 md:w-12 md:h-14" />
                        }

                        return (
                          <button
                            key={index}
                            disabled={loadingMove}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (selectedCourse) {
                                // Clicou num destino
                                handleSeatClick(row.name, seatNumber)
                              } else if (!seat.isEmpty) {
                                // Seleciona curso para mover
                                handleCourseClick(seat.curso, seat.cursoId)
                              }
                            }}
                            onMouseEnter={() => {
                              if (selectedCourse) setHoveredSeat({ fila: row.name, seat: seatNumber })
                            }}
                            onMouseLeave={() => {
                              if (selectedCourse) setHoveredSeat(null)
                            }}
                            className={cn(
                              "relative w-10 h-12 md:w-12 md:h-14 rounded-lg flex flex-col items-center justify-center transition-all border-2 text-white shadow-md cursor-pointer disabled:cursor-wait",
                              seat.isEmpty
                                ? "bg-muted border-dashed border-muted-foreground/40 cursor-default"
                                : cn(
                                    courseColors[seat.curso]?.split(" ")[0],
                                    "hover:scale-105",
                                    isSelected
                                      ? "ring-4 ring-yellow-400 scale-110 shadow-lg"
                                      : selectedCourse && isHovered
                                      ? "ring-4 ring-green-400 scale-105"
                                      : isOtherCourse
                                      ? "opacity-40"
                                      : ""
                                  )
                            )}
                            title={
                              seat.isEmpty
                                ? `Vazio - ${seatNumber}`
                                : `${seat.curso} - assento ${seatNumber}`
                            }
                          >
                            <Armchair className="w-3 h-3 md:w-4 md:h-4 mb-0.5" strokeWidth={2.5} />
                            <span className="text-[9px] md:text-[10px] font-bold leading-none">
                              {seatNumber}
                            </span>
                            <div
                              className={cn(
                                "absolute -bottom-1 w-6 md:w-8 h-0.5 md:h-1 rounded-full",
                                seat.isEmpty ? "bg-muted-foreground/30" : "bg-black/20"
                              )}
                            />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dica do curso selecionado */}
      {selectedCourse && !loadingMove && (
        <div className="p-3 md:p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-xs md:text-sm">
          <strong>Turma selecionada:</strong> {selectedCourse.nome} (
          {courseSeats[selectedCourse.nome]} assentos). Clique na cadeira onde deseja começar a alocação.
        </div>
      )}
    </div>
  )
}