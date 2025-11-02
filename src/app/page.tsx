"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Download, MapPin, Users, Calendar, Plus } from "lucide-react"
import { SeatMap } from "@/components/seat-map"
import { AllocationStats } from "@/components/allocation-stats"
import type { AllocationResponse } from "@/types/allocation"
import { API_URL } from "./layout"

export default function Home() {
  const [planilhaUrl, setPlanilhaUrl] = useState("")
  const [localId, setLocalId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AllocationResponse | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(`${API_URL}/api/planilha/processar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planilha_url: planilhaUrl,
          local_id: localId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Erro ao processar planilha")
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!result) return
    console.log("Download functionality to be implemented")
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header com botão Novo Local */}
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">
              Sistema de Alocação de Assentos
            </h1>
            <p className="text-muted-foreground text-lg">
              Gerencie a distribuição de assentos para formaturas
            </p>
          </div>
          
          <Button 
            variant="outline"
            size="lg"
            onClick={() => window.location.href = '/criar-local'}
            className="shrink-0"
          >
            <Plus className="mr-2 h-5 w-5" />
            Novo Local
          </Button>
        </div>

        {/* Form Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Processar Planilha</CardTitle>
            <CardDescription>
              Insira a URL da planilha do Google Sheets e o ID do local para gerar a alocação
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="planilha-url">URL da Planilha (CSV Export)</Label>
                <Input
                  id="planilha-url"
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv"
                  value={planilhaUrl}
                  onChange={(e) => setPlanilhaUrl(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="local-id">ID do Local</Label>
                <Input
                  id="local-id"
                  type="text"
                  placeholder="68e13b6f263e394a94c813a7"
                  value={localId}
                  onChange={(e) => setLocalId(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Processando...
                  </>
                ) : (
                  "Gerar Alocação"
                )}
              </Button>
            </form>

            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Formatura</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-balance">{result.formatura.nome}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(result.formatura.data).toLocaleDateString("pt-BR")}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Local</CardTitle>
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{result.formatura.local}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Taxa de ocupação: {result.alocacao.taxa_ocupacao}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Formandos</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{result.formatura.total_formandos}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {result.alocacao.total_alocado} assentos alocados
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Allocation Details */}
            <AllocationStats details={result.alocacao.detalhes} />

            {/* Seat Map */}
            <Card className="shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Mapa de Assentos</CardTitle>
                  <CardDescription>Visualização da distribuição de assentos por curso</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar
                </Button>
              </CardHeader>
              <CardContent>
                <SeatMap details={result.alocacao.detalhes} assentosVazios={result.alocacao.assentos_vazios} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  )
}
