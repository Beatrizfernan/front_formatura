"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Armchair } from "lucide-react"
import type { AllocationDetail, AssentosVazios } from "@/types/allocation"

interface SeatMapProps {
  details: AllocationDetail[]
  assentosVazios?: AssentosVazios[]
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
}

const COURSE_COLORS = [
  "bg-blue-500 hover:bg-blue-600 border-blue-700",
  "bg-emerald-500 hover:bg-emerald-600 border-emerald-700",
  "bg-amber-500 hover:bg-amber-600 border-amber-700",
  "bg-purple-500 hover:bg-purple-600 border-purple-700",
  "bg-rose-500 hover:bg-rose-600 border-rose-700",
  "bg-cyan-500 hover:bg-cyan-600 border-cyan-700",
  "bg-orange-500 hover:bg-orange-600 border-orange-700",
  "bg-pink-500 hover:bg-pink-600 border-pink-700",
]

export function SeatMap({ details, assentosVazios }: SeatMapProps) {
  const { rowGroups, courseColors, totalEmpty } = useMemo(() => {
    // Assign colors to courses
    const colors: Record<string, string> = {}
    details.forEach((detail, index) => {
      colors[detail.curso] = COURSE_COLORS[index % COURSE_COLORS.length]
    })

    // Build seat map
    const rowMap = new Map<string, Map<number, Seat>>()

    details.forEach((detail) => {
      detail.filas.forEach((fila) => {
        if (!rowMap.has(fila.fila)) {
          rowMap.set(fila.fila, new Map())
        }

        const row = rowMap.get(fila.fila)!
        const [start, end] = fila.range.split("-").map(Number)

        for (let i = start; i <= end; i++) {
          row.set(i, {
            number: i,
            curso: detail.curso,
            color: colors[detail.curso],
          })
        }
      })
    })

    let emptyCount = 0
    if (assentosVazios) {
      assentosVazios.forEach((filaVazia) => {
        if (!rowMap.has(filaVazia.fila)) {
          rowMap.set(filaVazia.fila, new Map())
        }

        const row = rowMap.get(filaVazia.fila)!
        filaVazia.assentos_vazios.forEach((seatNumber) => {
          row.set(seatNumber, {
            number: seatNumber,
            curso: "Vazio",
            color: "bg-muted",
            isEmpty: true,
          })
          emptyCount++
        })
      })
    }

    // Convert to array format and group by row number
    const rowsArray: Row[] = Array.from(rowMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, seatMap]) => {
        const maxSeat = Math.max(...Array.from(seatMap.keys()))
        const seats: (Seat | null)[] = []

        for (let i = 1; i <= maxSeat; i++) {
          seats.push(seatMap.get(i) || null)
        }

        return { name, seats }
      })

    // Group rows by number (1A, 1B, 1C -> group "1")
    const grouped = new Map<string, Row[]>()
    rowsArray.forEach((row) => {
      const rowNumber = row.name.match(/^\d+/)?.[0] || row.name
      if (!grouped.has(rowNumber)) {
        grouped.set(rowNumber, [])
      }
      grouped.get(rowNumber)!.push(row)
    })

    // Convert to sorted array
    const groupedArray = Array.from(grouped.entries())
      .sort(([a], [b]) => {
        const numA = Number.parseInt(a) || 0
        const numB = Number.parseInt(b) || 0
        return numA - numB
      })
      .map(([_, rows]) => rows)

    return { rowGroups: groupedArray, courseColors: colors, totalEmpty: emptyCount }
  }, [details, assentosVazios])

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Legend */}
      <div className="flex flex-wrap gap-2 md:gap-3 justify-center p-3 md:p-4 bg-muted/50 rounded-lg">
        {details.map((detail) => (
          <div key={detail.curso} className="flex items-center gap-1.5 md:gap-2">
            <div className={cn("w-3 h-3 md:w-4 md:h-4 rounded", courseColors[detail.curso].split(" ")[0])} />
            <span className="text-xs md:text-sm font-medium">{detail.curso}</span>
            <Badge variant="secondary" className="text-xs">
              {detail.total_assentos}
            </Badge>
          </div>
        ))}
        {totalEmpty > 0 && (
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-3 h-3 md:w-4 md:h-4 rounded bg-muted border-2 border-dashed border-muted-foreground/40" />
            <span className="text-xs md:text-sm font-medium">Vazios</span>
            <Badge variant="secondary" className="text-xs">
              {totalEmpty}
            </Badge>
          </div>
        )}
      </div>

      {/* Stage indicator */}
      <div className="flex justify-center">
        <div className="bg-muted px-4 md:px-8 py-1.5 md:py-2 rounded-t-lg border-2 border-b-0 border-border">
          <span className="text-xs md:text-sm font-semibold text-muted-foreground">PALCO</span>
        </div>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="min-w-max space-y-6 md:space-y-8 px-2">
          {rowGroups.map((rowGroup, groupIndex) => (
            <div key={groupIndex} className="border-b border-border/50 pb-4 md:pb-6 last:border-b-0">
              <div className="flex gap-4 md:gap-8 lg:gap-12 justify-start items-start">
                {rowGroup.map((row) => (
                  <div key={row.name} className="flex flex-col items-center space-y-2 md:space-y-3">
                    {/* Row label */}
                    <Badge
                      variant="outline"
                      className="font-mono font-bold text-xs md:text-base px-2 md:px-3 py-0.5 md:py-1"
                    >
                      Fila {row.name}
                    </Badge>

                    <div className="flex gap-1 md:gap-1.5">
                      {row.seats.map((seat, index) =>
                        seat ? (
                          <div
                            key={index}
                            className={cn(
                              "relative w-10 h-12 md:w-14 md:h-16 rounded-lg flex flex-col items-center justify-center transition-all duration-200 border-2",
                              seat.isEmpty
                                ? "bg-muted border-dashed border-muted-foreground/40 text-muted-foreground cursor-default hover:bg-muted/80"
                                : `${seat.color} text-white shadow-md cursor-pointer hover:scale-105 hover:shadow-lg`,
                            )}
                            title={
                              seat.isEmpty ? `Vazio - Assento ${seat.number}` : `${seat.curso} - Assento ${seat.number}`
                            }
                          >
                            {/* Chair icon */}
                            <Armchair className="w-4 h-4 md:w-5 md:h-5 mb-0.5" strokeWidth={2.5} />
                            {/* Seat number */}
                            <span className="text-[10px] md:text-xs font-bold">{seat.number}</span>
                            {/* Chair base */}
                            <div
                              className={cn(
                                "absolute -bottom-1 w-8 md:w-10 h-1 md:h-1.5 rounded-full",
                                seat.isEmpty ? "bg-muted-foreground/30" : "bg-black/20",
                              )}
                            />
                          </div>
                        ) : null,
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
