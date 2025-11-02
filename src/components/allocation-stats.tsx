"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { AllocationDetail } from "@/types/allocation"

interface AllocationStatsProps {
  details: AllocationDetail[]
}

export function AllocationStats({ details }: AllocationStatsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalhes da Alocação</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {details.map((detail, index) => (
            <div
              key={index}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-muted/50 border border-border"
            >
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">{detail.curso}</h3>
                <p className="text-sm text-muted-foreground">Total: {detail.total_assentos} assentos</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {detail.filas.map((fila, filaIndex) => (
                  <Badge key={filaIndex} variant="secondary" className="font-mono">
                    Fila {fila.fila}: {fila.range} ({fila.assentos} assentos)
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
