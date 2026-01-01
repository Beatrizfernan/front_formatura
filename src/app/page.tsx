"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, Download, MapPin, Users, Calendar, Plus } from "lucide-react"
import { SeatMap } from "@/components/seat-map"
import { AllocationStats } from "@/components/allocation-stats"
import type { AllocationResponse } from "@/types/allocation"
import { API_URL } from "./layout"
import jsPDF from 'jspdf'

interface Local {
  id: string
  nome: string
  capacidade?: number
}

export default function Home() {
  const [planilhaUrl, setPlanilhaUrl] = useState("")
  const [localId, setLocalId] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AllocationResponse | null>(null)
  
  // Estados para os locais
  const [locais, setLocais] = useState<Local[]>([])
  const [loadingLocais, setLoadingLocais] = useState(true)

  // Buscar locais ao carregar a página
  useEffect(() => {
    const fetchLocais = async () => {
      try {
        const response = await fetch(`${API_URL}/listar_locais/`)
        if (!response.ok) throw new Error("Erro ao buscar locais")
        const data = await response.json()
        setLocais(data)
      } catch (err) {
        console.error("Erro ao carregar locais:", err)
      } finally {
        setLoadingLocais(false)
      }
    }
    fetchLocais()
  }, [])

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

  const handleDownload = async () => {
    if (!result || !result.alocacao?.detalhes) return
  
    setLoadingPdf(true)
    
    try {
      const domtoimage = (await import('dom-to-image-more')).default
      
      // Cria container temporário
      const tempContainer = document.createElement('div')
      tempContainer.style.position = 'absolute'
      tempContainer.style.left = '-9999px'
      tempContainer.style.top = '0'
      tempContainer.style.backgroundColor = '#ffffff'
      tempContainer.style.padding = '40px'
      tempContainer.style.width = 'max-content'
      
      // Prepara cores dos cursos
      const COURSE_COLORS = [
        'rgb(59, 130, 246)', // blue
        'rgb(16, 185, 129)', // emerald
        'rgb(245, 158, 11)', // amber
        'rgb(168, 85, 247)', // purple
        'rgb(244, 63, 94)',  // rose
        'rgb(6, 182, 212)',  // cyan
        'rgb(249, 115, 22)', // orange
        'rgb(236, 72, 153)', // pink
      ]
      
      const courseColors: Record<string, string> = {}
      result.alocacao.detalhes.forEach((detail, index) => {
        courseColors[detail.curso] = COURSE_COLORS[index % COURSE_COLORS.length]
      })
      
      // Constrói mapa de assentos
      const rowMap = new Map<string, Map<number, { curso: string, isEmpty: boolean }>>()
      
      result.alocacao.detalhes.forEach((detail) => {
        detail.filas.forEach((fila) => {
          if (!rowMap.has(fila.fila)) {
            rowMap.set(fila.fila, new Map())
          }
          const row = rowMap.get(fila.fila)!
          const [start, end] = fila.range.split("-").map(Number)
          for (let i = start; i <= end; i++) {
            row.set(i, { curso: detail.curso, isEmpty: false })
          }
        })
      })
      
      // Adiciona assentos vazios
      if (result.alocacao.assentos_vazios) {
        result.alocacao.assentos_vazios.forEach((filaVazia) => {
          if (!rowMap.has(filaVazia.fila)) {
            rowMap.set(filaVazia.fila, new Map())
          }
          const row = rowMap.get(filaVazia.fila)!
          filaVazia.assentos_vazios.forEach((seatNumber) => {
            row.set(seatNumber, { curso: 'Vazio', isEmpty: true })
          })
        })
      }
      
      // Cria HTML
      let html = `
        <div style="font-family: system-ui, -apple-system, sans-serif;">
          <!-- Legenda -->
          <div style="display: flex; gap: 16px; justify-content: center; padding: 16px; background: #f3f4f6; border-radius: 8px; margin-bottom: 24px; flex-wrap: wrap;">
            ${result.alocacao.detalhes.map(detail => `
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 16px; height: 16px; border-radius: 4px; background: ${courseColors[detail.curso]};"></div>
                <span style="font-size: 14px; font-weight: 600;">${detail.curso}</span>
                <span style="background: #e5e7eb; padding: 2px 8px; border-radius: 12px; font-size: 12px;">${detail.total_assentos}</span>
              </div>
            `).join('')}
          </div>
          
          <!-- Palco -->
          <div style="display: flex; justify-content: center; margin-bottom: 32px;">
            <div style="background: #f3f4f6; padding: 8px 32px; border-radius: 8px 8px 0 0; border: 2px solid #d1d5db; border-bottom: 0;">
              <span style="font-size: 14px; font-weight: 700; color: #6b7280;">PALCO</span>
            </div>
          </div>
          
          <!-- Filas -->
          <div style="display: flex; flex-direction: column; gap: 32px;">
      `
      
      // Agrupa filas por número
      const rowsArray = Array.from(rowMap.entries()).sort(([a], [b]) => a.localeCompare(b))
      const grouped = new Map<string, typeof rowsArray>()
      
      rowsArray.forEach(([name, seats]) => {
        const rowNumber = name.match(/^\d+/)?.[0] || name
        if (!grouped.has(rowNumber)) {
          grouped.set(rowNumber, [])
        }
        grouped.get(rowNumber)!.push([name, seats])
      })
      
      const groupedArray = Array.from(grouped.entries())
        .sort(([a], [b]) => (parseInt(a) || 0) - (parseInt(b) || 0))
      
      groupedArray.forEach(([_, rows]) => {
        html += '<div style="display: flex; gap: 48px; border-bottom: 1px solid #e5e7eb; padding-bottom: 24px;">'
        
        rows.forEach(([rowName, seatMap]) => {
          const maxSeat = Math.max(...Array.from(seatMap.keys()))
          
          html += `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
              <div style="border: 1px solid #d1d5db; padding: 4px 12px; border-radius: 6px; font-weight: 700; font-size: 14px;">
                Fila ${rowName}
              </div>
              <div style="display: flex; gap: 6px;">
          `
          
          for (let i = 1; i <= maxSeat; i++) {
            const seat = seatMap.get(i)
            if (seat) {
              const color = seat.isEmpty ? '#f3f4f6' : courseColors[seat.curso]
              const borderStyle = seat.isEmpty ? '2px dashed #9ca3af' : '2px solid rgba(0,0,0,0.2)'
              const textColor = seat.isEmpty ? '#6b7280' : '#ffffff'
              
              html += `
                <div style="
                  width: 56px; 
                  height: 64px; 
                  border-radius: 8px; 
                  background: ${color}; 
                  border: ${borderStyle};
                  display: flex; 
                  flex-direction: column; 
                  align-items: center; 
                  justify-content: center;
                  position: relative;
                  box-shadow: ${seat.isEmpty ? 'none' : '0 4px 6px rgba(0,0,0,0.1)'};
                ">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${textColor}" stroke-width="2.5">
                    <path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/>
                    <path d="M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/>
                  </svg>
                  <span style="font-size: 12px; font-weight: 700; color: ${textColor};">${i}</span>
                  <div style="position: absolute; bottom: -4px; width: 40px; height: 6px; border-radius: 999px; background: rgba(0,0,0,0.2);"></div>
                </div>
              `
            }
          }
          
          html += '</div></div>'
        })
        
        html += '</div>'
      })
      
      html += '</div></div>'
      
      tempContainer.innerHTML = html
      document.body.appendChild(tempContainer)
      
      // Aguarda renderização
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Captura dimensões
      const width = tempContainer.offsetWidth
      const height = tempContainer.offsetHeight
      
      console.log('Dimensões:', { width, height })
      
      // Gera imagem
      const dataUrl = await domtoimage.toPng(tempContainer, {
        quality: 1,
        bgcolor: '#ffffff',
        width: width,
        height: height,
      })
      
      // Remove container
      document.body.removeChild(tempContainer)
      
      // Cria PDF
      const img = new Image()
      img.src = dataUrl
      await new Promise((resolve) => { img.onload = resolve })
      
      const isLandscape = img.width > img.height
      const pdf = new jsPDF(isLandscape ? 'l' : 'p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      
      const scale = Math.min(pageWidth / img.width, pageHeight / img.height)
      const scaledWidth = img.width * scale
      const scaledHeight = img.height * scale
      
      const x = (pageWidth - scaledWidth) / 2
      const y = (pageHeight - scaledHeight) / 2
      
      pdf.addImage(dataUrl, 'PNG', x, y, scaledWidth, scaledHeight)
      pdf.save(`mapa-assentos-${result.formatura.nome.replace(/\s+/g, '-')}.pdf`)
      
    } catch (error) {
      console.error('Erro ao gerar PDF:', error)
      setError('Erro ao gerar PDF. Tente novamente.')
    } finally {
      setLoadingPdf(false)
    }
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
              Insira a URL da planilha do Google Sheets e selecione o local para gerar a alocação
            </CardDescription>
          </CardHeader>
          <CardContent >
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
                <Label htmlFor="local-id">Local</Label>
                <Select 
                  value={localId} 
                  onValueChange={setLocalId}
                  disabled={loading || loadingLocais}
                >
                  <SelectTrigger id="local-id">
                    <SelectValue placeholder={loadingLocais ? "Carregando locais..." : "Selecione um local"} />
                  </SelectTrigger>
                  <SelectContent>
                    {locais.map((local) => (
                      <SelectItem key={local.id} value={local.id}>
                        {local.nome}
                        {local.capacidade && ` (${local.capacidade} lugares)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {locais.length === 0 && !loadingLocais && (
                  <p className="text-sm text-muted-foreground">
                    Nenhum local cadastrado.{" "}
                    <a href="/criar-local" className="text-primary hover:underline">
                      Criar novo local
                    </a>
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={loading || !localId}>
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
            Taxa de ocupação: {result.alocacao?.taxa_ocupacao || 'N/A'}
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
            {result.alocacao?.total_alocado || 0} assentos alocados
          </p>
        </CardContent>
      </Card>
    </div>

    {/* Allocation Details */}
    {result.alocacao?.detalhes && (
      <AllocationStats details={result.alocacao.detalhes} />
    )}

    {/* Seat Map */}
    {result.alocacao?.detalhes && (
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Mapa de Assentos</CardTitle>
            <CardDescription>Visualização da distribuição de assentos por curso</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDownload}
            disabled={loadingPdf}
          >
            {loadingPdf ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Gerando PDF...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Exportar PDF
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent >
          <SeatMap 
            details={result.alocacao.detalhes} 
            assentosVazios={result.alocacao.assentos_vazios || []} 
          />
        </CardContent>
      </Card>
    )}

    {/* Mensagem se não houver alocação */}
    {!result.alocacao && (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Nenhuma alocação foi gerada para esta formatura.
        </AlertDescription>
      </Alert>
    )}
  </div>

        )}
      </div>
    </main>
  )
}