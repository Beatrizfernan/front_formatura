import { useState, useMemo, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { Armchair, AlertCircle, RotateCcw } from 'lucide-react'

interface FilaDetail {
  fila: string
  assentos: number
  range: string
}

interface AllocationDetail {
  curso: string
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
  curso: string
  color: string
  isEmpty?: boolean
}

interface Row {
  name: string
  seats: (Seat | null)[]
  maxCapacity: number // Nova propriedade para armazenar capacidade original
}

const COURSE_COLORS = [
  'bg-blue-500 hover:bg-blue-600',
  'bg-emerald-500 hover:bg-emerald-600',
  'bg-amber-500 hover:bg-amber-600',
  'bg-purple-500 hover:bg-purple-600',
  'bg-rose-500 hover:bg-rose-600',
  'bg-cyan-500 hover:bg-cyan-600',
  'bg-orange-500 hover:bg-orange-600',
  'bg-pink-500 hover:bg-pink-600',
]

function initializeSeatMap(
  details: AllocationDetail[],
  assentosVazios: AssentosVazios[] = []
): { seatMap: Map<string, Map<number, Seat>>; courseColors: Record<string, string>; filaCapacities: Map<string, number> } {
  const seatMap = new Map<string, Map<number, Seat>>()
  const courseColors: Record<string, string> = {}
  const filaCapacities = new Map<string, number>()

  // Atribui cores aos cursos
  details.forEach((detail, index) => {
    courseColors[detail.curso] = COURSE_COLORS[index % COURSE_COLORS.length]
  })

  // Primeiro, determina a capacidade máxima de cada fila
  details.forEach((detail) => {
    detail.filas.forEach((fila) => {
      const [start, end] = fila.range.split('-').map(Number)
      const currentMax = filaCapacities.get(fila.fila) || 0
      filaCapacities.set(fila.fila, Math.max(currentMax, end))
    })
  })

  // Adiciona assentos vazios para determinar capacidade
  assentosVazios.forEach((filaVazia) => {
    const maxEmpty = Math.max(...filaVazia.assentos_vazios)
    const currentMax = filaCapacities.get(filaVazia.fila) || 0
    filaCapacities.set(filaVazia.fila, Math.max(currentMax, maxEmpty))
  })

  // Inicializa o mapa de assentos
  details.forEach((detail) => {
    detail.filas.forEach((fila) => {
      if (!seatMap.has(fila.fila)) {
        seatMap.set(fila.fila, new Map())
      }

      const row = seatMap.get(fila.fila)!
      const [start, end] = fila.range.split('-').map(Number)

      for (let i = start; i <= end; i++) {
        row.set(i, {
          number: i,
          curso: detail.curso,
          color: courseColors[detail.curso],
        })
      }
    })
  })

  // Adiciona assentos vazios
  assentosVazios.forEach((filaVazia) => {
    if (!seatMap.has(filaVazia.fila)) {
      seatMap.set(filaVazia.fila, new Map())
    }

    const row = seatMap.get(filaVazia.fila)!
    filaVazia.assentos_vazios.forEach((seatNumber) => {
      row.set(seatNumber, {
        number: seatNumber,
        curso: 'Vazio',
        color: 'bg-muted',
        isEmpty: true,
      })
    })
  })

  return { seatMap, courseColors, filaCapacities }
}

interface SeatMapDragDropProps {
  details: AllocationDetail[]
  assentosVazios?: AssentosVazios[]
  onStateChange?: (seatMap: Map<string, Map<number, Seat>>) => void
}

export default function SeatMapDragDrop({
  details,
  assentosVazios = [],
  onStateChange,
}: SeatMapDragDropProps) {
  const initialState = useMemo(() => initializeSeatMap(details, assentosVazios), [details, assentosVazios])

  const [seatMap, setSeatMap] = useState<Map<string, Map<number, Seat>>>(initialState.seatMap)
  const [draggedCourse, setDraggedCourse] = useState<string | null>(null)
  const [hoveredSeat, setHoveredSeat] = useState<{ fila: string; seat: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const courseColors = initialState.courseColors
  const filaCapacities = initialState.filaCapacities

  // Calcula quantos assentos cada curso possui
  const courseSeats = useMemo(() => {
    const counts = new Map<string, number>()
    details.forEach(detail => {
      counts.set(detail.curso, detail.total_assentos)
    })
    return counts
  }, [details])

  // Converte o mapa para array de filas ordenadas
  const rowGroups = useMemo(() => {
    const rowsArray: Row[] = Array.from(seatMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, seatMap]) => {
        const maxCapacity = filaCapacities.get(name) || 0
        const seats: (Seat | null)[] = []

        for (let i = 1; i <= maxCapacity; i++) {
          seats.push(seatMap.get(i) || null)
        }

        return { name, seats, maxCapacity }
      })

    const grouped = new Map<string, Row[]>()
    rowsArray.forEach((row) => {
      const rowNumber = row.name.match(/^\d+/)?.[0] || row.name
      if (!grouped.has(rowNumber)) {
        grouped.set(rowNumber, [])
      }
      grouped.get(rowNumber)!.push(row)
    })

    return Array.from(grouped.entries())
      .sort(([a], [b]) => {
        const numA = Number.parseInt(a) || 0
        const numB = Number.parseInt(b) || 0
        return numA - numB
      })
      .map(([, rows]) => rows)
  }, [seatMap, filaCapacities])

  const handleCourseClick = useCallback((course: string) => {
    if (course === 'Vazio') return
    setDraggedCourse(draggedCourse === course ? null : course)
    setError(null)
  }, [draggedCourse])

  const handleSeatDrop = useCallback(
    (targetFila: string, targetSeatNumber: number) => {
      if (!draggedCourse) return
  
      const totalSeats = courseSeats.get(draggedCourse)
      if (!totalSeats) {
        setError('Curso não encontrado')
        setTimeout(() => setError(null), 3000)
        return
      }
  
      const newSeatMap = new Map(seatMap)
      const sortedFilas = Array.from(filaCapacities.keys()).sort((a, b) => {
        const numA = parseInt(a.match(/^\d+/)?.[0] || '0')
        const numB = parseInt(b.match(/^\d+/)?.[0] || '0')
        const letterA = a.match(/([A-Z])$/)?.[1] || ''
        const letterB = b.match(/([A-Z])$/)?.[1] || ''
        if (numA !== numB) return numA - numB
        return letterA.localeCompare(letterB)
      })
  
      const targetFilaIndex = sortedFilas.indexOf(targetFila)
      if (targetFilaIndex === -1) {
        setError('Fila de destino inválida')
        setTimeout(() => setError(null), 3000)
        return
      }
  
      // ✅ PASSO 1: Remove APENAS o curso arrastado (de qualquer lugar)
      newSeatMap.forEach((row) => {
        const toDelete: number[] = []
        row.forEach((seat, num) => {
          if (seat.curso === draggedCourse) toDelete.push(num)
        })
        toDelete.forEach(num => row.delete(num))
      })
  
      // ✅ PASSO 2: Preenche vazios
      newSeatMap.forEach((row, filaName) => {
        const maxCapacity = filaCapacities.get(filaName) || 0
        for (let i = 1; i <= maxCapacity; i++) {
          if (!row.has(i)) {
            row.set(i, { number: i, curso: 'Vazio', color: 'bg-muted', isEmpty: true })
          }
        }
      })
  
      // ✅ PASSO 3: Coleta TODOS os cursos afetados (que estão a partir da posição target)
      const displacedCourses: Record<string, number> = {}
      for (let i = targetFilaIndex; i < sortedFilas.length; i++) {
        const filaName = sortedFilas[i]
        const fila = newSeatMap.get(filaName)!
        const maxCapacity = filaCapacities.get(filaName) || 0
        
        const startPos = i === targetFilaIndex ? targetSeatNumber : 1
        for (let seatNum = startPos; seatNum <= maxCapacity; seatNum++) {
          const seat = fila.get(seatNum)
          if (seat && seat.curso !== 'Vazio') {
            displacedCourses[seat.curso] = (displacedCourses[seat.curso] || 0) + 1
          }
        }
      }
  
      // ✅ PASSO 4: Limpa TODAS as posições a partir do target para "empurrar"
      for (let i = targetFilaIndex; i < sortedFilas.length; i++) {
        const filaName = sortedFilas[i]
        const fila = newSeatMap.get(filaName)!
        const maxCapacity = filaCapacities.get(filaName) || 0
        
        const startPos = i === targetFilaIndex ? targetSeatNumber : 1
        for (let seatNum = startPos; seatNum <= maxCapacity; seatNum++) {
          fila.set(seatNum, { number: seatNum, curso: 'Vazio', color: 'bg-muted', isEmpty: true })
        }
      }
  
      // ✅ PASSO 5: INSERE o curso arrastado na posição EXATA
      let seatsToPlace = totalSeats
      let filaIdx = targetFilaIndex
      let seatNum = targetSeatNumber
  
      while (seatsToPlace > 0 && filaIdx < sortedFilas.length) {
        const filaName = sortedFilas[filaIdx]
        const maxCapacity = filaCapacities.get(filaName) || 0
        const fila = newSeatMap.get(filaName)!
  
        while (seatNum <= maxCapacity && seatsToPlace > 0) {
          fila.set(seatNum, {
            number: seatNum,
            curso: draggedCourse,
            color: courseColors[draggedCourse],
          })
          seatsToPlace--
          seatNum++
        }
  
        filaIdx++
        seatNum = 1
      }
  
      // ✅ PASSO 6: REALOCA cursos deslocados (mantendo suas quantidades originais)
      const displacedOrder = Object.keys(displacedCourses)
      for (const course of displacedOrder) {
        let remainingSeats = displacedCourses[course]
        let currentFilaIdx = targetFilaIndex
        let currentSeatNum = targetSeatNumber
  
        while (remainingSeats > 0 && currentFilaIdx < sortedFilas.length) {
          const filaName = sortedFilas[currentFilaIdx]
          const maxCapacity = filaCapacities.get(filaName) || 0
          const fila = newSeatMap.get(filaName)!
  
          while (currentSeatNum <= maxCapacity && remainingSeats > 0) {
            if (fila.get(currentSeatNum)?.curso === 'Vazio') {
              fila.set(currentSeatNum, {
                number: currentSeatNum,
                curso: course,
                color: courseColors[course],
              })
              remainingSeats--
            }
            currentSeatNum++
          }
  
          currentFilaIdx++
          currentSeatNum = 1
        }
      }
  
      setSeatMap(newSeatMap)
      onStateChange?.(newSeatMap)
      setDraggedCourse(null)
      setHoveredSeat(null)
    },
    [draggedCourse, courseSeats, seatMap, courseColors, filaCapacities, onStateChange]
  )
  

  
  
  
  const handleReset = useCallback(() => {
    const newState = initializeSeatMap(details, assentosVazios)
    setSeatMap(newState.seatMap)
    onStateChange?.(newState.seatMap)
    setDraggedCourse(null)
    setError(null)
  }, [details, assentosVazios, onStateChange])

  return (
    <div className="space-y-6 w-full">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between gap-4">
        {/* Legend */}
        <div className="flex flex-wrap gap-2 md:gap-3 p-3 md:p-4 bg-muted/50 rounded-lg flex-1">
          {details.map((detail) => (
            <div key={detail.curso} className="flex items-center gap-1.5 md:gap-2">
              <div className={cn('w-3 h-3 md:w-4 md:h-4 rounded', courseColors[detail.curso].split(' ')[0])} />
              <span className="text-xs md:text-sm font-medium">{detail.curso}</span>
              <Badge variant="secondary" className="text-xs">
                {detail.total_assentos}
              </Badge>
            </div>
          ))}
        </div>

        {/* Reset Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          className="shrink-0"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>
      </div>

      {/* Instructions */}
      <div className="p-3 md:p-4 bg-blue-50 border border-blue-200 rounded-lg text-xs md:text-sm text-blue-900">
        <strong>Como usar:</strong> Clique em qualquer cadeira de uma turma para selecioná-la. Depois, clique na cadeira específica onde deseja começar a alocar a turma. As demais cadeiras serão alocadas sequencialmente.
      </div>

      {/* Stage */}
      <div className="flex justify-center">
        <div className="bg-muted px-6 md:px-8 py-1.5 md:py-2 rounded-t-lg border-2 border-b-0 border-border">
          <span className="text-xs md:text-sm font-semibold text-muted-foreground">PALCO</span>
        </div>
      </div>

      {/* Seat Map */}
      <div className="overflow-x-auto pb-4 px-2">
        <div className="min-w-max space-y-6">
          {rowGroups.map((rowGroup, groupIndex) => (
            <div key={groupIndex} className="border-b border-border/50 pb-6 last:border-b-0">
              <div className="flex gap-6 md:gap-8 items-start justify-start">
                {rowGroup.map((row) => (
                  <div
                    key={row.name}
                    className="flex flex-col items-center space-y-2 md:space-y-3"
                  >
                    <Badge variant="outline" className="font-mono font-bold text-xs md:text-base">
                      Fila {row.name}
                    </Badge>

                    <div className="flex gap-1 md:gap-2">
                      {row.seats.map((seat, index) => {
                        const seatNumber = index + 1
                        const isHovered = hoveredSeat?.fila === row.name && hoveredSeat?.seat === seatNumber
                        
                        return seat ? (
                          <button
                            key={index}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (draggedCourse) {
                                handleSeatDrop(row.name, seatNumber)
                              } else if (!seat.isEmpty) {
                                handleCourseClick(seat.curso)
                              }
                            }}
                            onMouseEnter={() => {
                              if (draggedCourse) {
                                setHoveredSeat({ fila: row.name, seat: seatNumber })
                              }
                            }}
                            onMouseLeave={() => {
                              if (draggedCourse) {
                                setHoveredSeat(null)
                              }
                            }}
                            className={cn(
                              'relative w-10 h-12 md:w-12 md:h-14 rounded-lg flex flex-col items-center justify-center transition-all border-2 text-white shadow-md cursor-pointer',
                              seat.isEmpty
                                ? 'bg-muted border-dashed border-muted-foreground/40 cursor-default'
                                : cn(
                                    courseColors[seat.curso].split(' ')[0],
                                    'hover:scale-105',
                                    draggedCourse === seat.curso
                                      ? 'ring-4 ring-yellow-400 scale-110 shadow-lg'
                                      : draggedCourse && isHovered
                                      ? 'ring-4 ring-green-400 scale-105'
                                      : draggedCourse && draggedCourse !== seat.curso
                                      ? 'opacity-40'
                                      : ''
                                  )
                            )}
                            title={seat.isEmpty ? `Vazio - ${seatNumber}` : `${seat.curso} - ${seatNumber}`}
                          >
                            <Armchair className="w-3 h-3 md:w-4 md:h-4 mb-0.5" strokeWidth={2.5} />
                            <span className="text-[9px] md:text-[10px] font-bold leading-none">{seatNumber}</span>
                            <div
                              className={cn(
                                'absolute -bottom-1 w-6 md:w-8 h-0.5 md:h-1 rounded-full',
                                seat.isEmpty ? 'bg-muted-foreground/30' : 'bg-black/20'
                              )}
                            />
                          </button>
                        ) : (
                          <div key={index} className="w-10 h-12 md:w-12 md:h-14" />
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

      {draggedCourse && (
        <div className="p-3 md:p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-xs md:text-sm">
          <strong>Turma selecionada:</strong> {draggedCourse} ({courseSeats.get(draggedCourse)} assentos). Clique na cadeira onde deseja começar a alocação.
        </div>
      )}
    </div>
  )
}