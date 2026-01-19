"use client"

import React, { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, Download, MapPin, Users, Calendar, Plus, Upload, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

import { AllocationStats } from "@/components/allocation-stats"
import type { AllocationResponse } from "@/types/allocation"
import { API_URL } from "./layout"
import jsPDF from 'jspdf'
import SeatMapDragDrop from "@/components/seat-map"

interface Local {
  id: string
  nome: string
  capacidade?: number
}

export default function Home() {
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null)
  const [localId, setLocalId] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AllocationResponse | null>(null)
  const [locais, setLocais] = useState<Local[]>([])
  const [loadingLocais, setLoadingLocais] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragOverRef = useRef<HTMLDivElement>(null)

  // Estado para controlar o mapa de assentos modificado
  interface SeatInfo {
    number: number
    curso: string
    color: string
    isEmpty?: boolean
    groupId?: string
  }
  const [modifiedSeatMap, setModifiedSeatMap] = useState<Map<string, Map<number, SeatInfo>> | null>(null)

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

  const handleFileSelect = (file: File | null) => {
    if (!file) {
      setArquivoSelecionado(null)
      return
    }

    // Validar tipo de arquivo
    const allowedTypes = [
      "text/csv",
      "text/plain",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel"
    ]

    if (!allowedTypes.includes(file.type)) {
      setError("Por favor, selecione um arquivo CSV ou Excel válido")
      setTimeout(() => setError(null), 4000)
      return
    }

    // Validar tamanho (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("O arquivo deve ter menos de 5MB")
      setTimeout(() => setError(null), 4000)
      return
    }

    setArquivoSelecionado(file)
    setError(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (dragOverRef.current) {
      dragOverRef.current.classList.add("border-primary", "bg-primary/5")
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (dragOverRef.current) {
      dragOverRef.current.classList.remove("border-primary", "bg-primary/5")
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (dragOverRef.current) {
      dragOverRef.current.classList.remove("border-primary", "bg-primary/5")
    }

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!arquivoSelecionado) {
      setError("Por favor, selecione um arquivo")
      return
    }

    if (!localId) {
      setError("Por favor, selecione um local")
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setModifiedSeatMap(null)

    try {
      // Criar FormData para enviar o arquivo
      const formData = new FormData()
      formData.append("arquivo", arquivoSelecionado)
      formData.append("local_id", localId)

      const response = await fetch(
        `${API_URL}/api/planilha/processar`,
        {
          method: "POST",
          body: formData, // NÃO usar Content-Type: application/json
        }
      )

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

  const handleSeatMapStateChange = (newSeatMap: Map<string, Map<number, SeatInfo>>) => {
    setModifiedSeatMap(newSeatMap)
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
      tempContainer.style.padding = '15px'
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
      
      // Constrói mapa de assentos - usa modifiedSeatMap se disponível
      let rowMap: Map<string, Map<number, SeatInfo>>
      
      if (modifiedSeatMap) {
        rowMap = modifiedSeatMap
      } else {
        const tempRowMap = new Map<string, Map<number, SeatInfo>>()
        
        result.alocacao.detalhes.forEach((detail) => {
          detail.filas.forEach((fila) => {
            if (!tempRowMap.has(fila.fila)) {
              tempRowMap.set(fila.fila, new Map())
            }
            const row = tempRowMap.get(fila.fila)!
            const [start, end] = fila.range.split("-").map(Number)
            for (let i = start; i <= end; i++) {
              row.set(i, { 
                number: i,
                curso: detail.curso, 
                color: '',
                isEmpty: false 
              })
            }
          })
        })
        
        // Adiciona assentos vazios
        if (result.alocacao.assentos_vazios) {
          result.alocacao.assentos_vazios.forEach((filaVazia) => {
            if (!tempRowMap.has(filaVazia.fila)) {
              tempRowMap.set(filaVazia.fila, new Map())
            }
            const row = tempRowMap.get(filaVazia.fila)!
            filaVazia.assentos_vazios.forEach((seatNumber) => {
              row.set(seatNumber, { 
                number: seatNumber,
                curso: 'Vazio', 
                color: '',
                isEmpty: true 
              })
            })
          })
        }
        
        rowMap = tempRowMap
      }
      
      // Cria HTML com elementos MUITO MAIORES para máximo aproveitamento
      let html = `
        <div style="font-family: system-ui, -apple-system, sans-serif;">
          <!-- Legenda -->
          <div style="display: flex; gap: 28px; justify-content: center; padding: 20px; background: #f3f4f6; border-radius: 12px; margin-bottom: 35px; flex-wrap: wrap;">
            ${result.alocacao.detalhes.map(detail => `
              <div style="display: flex; align-items: center; gap: 14px;">
                <div style="width: 32px; height: 32px; border-radius: 6px; background: ${courseColors[detail.curso]};"></div>
                <span style="font-size: 24px; font-weight: 600;">${detail.curso}</span>
                <span style="background: #e5e7eb; padding: 5px 14px; border-radius: 18px; font-size: 20px; font-weight: 600;">${detail.total_assentos}</span>
              </div>
            `).join('')}
          </div>
          
          <!-- Palco -->
          <div style="display: flex; justify-content: center; margin-bottom: 40px;">
            <div style="background: #f3f4f6; padding: 16px 80px; border-radius: 14px 14px 0 0; border: 4px solid #d1d5db; border-bottom: 0;">
              <span style="font-size: 28px; font-weight: 700; color: #6b7280; letter-spacing: 3px;">PALCO</span>
            </div>
          </div>
          
          <!-- Filas -->
          <div style="display: flex; flex-direction: column; gap: 45px;">
      `
      
      // Agrupa filas por número
      const rowsArray = Array.from(rowMap.entries()).sort(([a], [b]) => a.localeCompare(b))
      const grouped = new Map<string, Array<[string, Map<number, SeatInfo>]>>()
      
      rowsArray.forEach(([name, seats]) => {
        const rowNumber = name.match(/^\d+/)?.[0] || name
        if (!grouped.has(rowNumber)) {
          grouped.set(rowNumber, [])
        }
        grouped.get(rowNumber)!.push([name, seats])
      })
      
      const groupedArray = Array.from(grouped.entries())
        .sort(([a], [b]) => (parseInt(a) || 0) - (parseInt(b) || 0))
      
      groupedArray.forEach(([, rows]) => {
        html += '<div style="display: flex; gap: 70px; border-bottom: 2px solid #e5e7eb; padding-bottom: 35px;">'
        
        rows.forEach(([rowName, seatMap]) => {
          const maxSeat = Math.max(...Array.from(seatMap.keys()))
          
          html += `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 18px;">
              <div style="border: 3px solid #d1d5db; padding: 8px 20px; border-radius: 8px; font-weight: 700; font-size: 22px; background: #ffffff;">
                Fila ${rowName}
              </div>
              <div style="display: flex; gap: 12px;">
          `
          
          for (let i = 1; i <= maxSeat; i++) {
            const seat = seatMap.get(i)
            if (seat) {
              const color = seat.isEmpty ? '#f3f4f6' : courseColors[seat.curso]
              const borderStyle = seat.isEmpty ? '4px dashed #9ca3af' : '4px solid rgba(0,0,0,0.2)'
              const textColor = seat.isEmpty ? '#6b7280' : '#ffffff'
              
              html += `
                <div style="
                  width: 180px; 
                  height: 220px; 
                  border-radius: 16px; 
                  background: ${color}; 
                  border: ${borderStyle};
                  display: flex; 
                  flex-direction: column; 
                  align-items: center; 
                  justify-content: center;
                  position: relative;
                  box-shadow: ${seat.isEmpty ? 'none' : '0 10px 20px rgba(0,0,0,0.2)'};
                  padding: 14px;
                ">
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="${textColor}" stroke-width="2.5" style="margin-bottom: 12px;">
                    <path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/>
                    <path d="M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/>
                  </svg>
                  
                  <!-- Número da cadeira -->
                  <span style="font-size: 36px; font-weight: 700; color: ${textColor}; line-height: 1.2; margin-top: 6px;">${i}</span>
                  
                  <!-- Nome do curso (só se não for vazio) -->
                  ${!seat.isEmpty ? `
                    <div style="font-size: 16px; font-weight: 600; color: ${textColor}; opacity: 0.96; margin-top: 12px; line-height: 1.3; text-align: center; max-width: 160px; overflow: hidden; word-break: break-word; text-transform: uppercase;">
                      ${seat.curso}
                    </div>
                  ` : ''}
                  
                  <div style="position: absolute; bottom: -10px; width: 100px; height: 14px; border-radius: 999px; background: rgba(0,0,0,0.28);"></div>
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
      
      // Aguarda renderização completa
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Captura dimensões ANTES da rotação
      const originalWidth = tempContainer.offsetWidth
      const originalHeight = tempContainer.offsetHeight
      
      console.log('Dimensões originais:', { originalWidth, originalHeight })
      
      // Cria um wrapper maior para comportar a rotação
      const rotationWrapper = document.createElement('div')
      rotationWrapper.style.position = 'absolute'
      rotationWrapper.style.left = '-9999px'
      rotationWrapper.style.top = '0'
      rotationWrapper.style.backgroundColor = '#ffffff'
      
      // Define dimensões do wrapper (invertidas para acomodar a rotação)
      rotationWrapper.style.width = `${originalHeight}px`
      rotationWrapper.style.height = `${originalWidth}px`
      rotationWrapper.style.display = 'flex'
      rotationWrapper.style.alignItems = 'center'
      rotationWrapper.style.justifyContent = 'center'
      rotationWrapper.style.overflow = 'visible'
      
      // Move o conteúdo para o wrapper
      document.body.appendChild(rotationWrapper)
      rotationWrapper.appendChild(tempContainer)
      
      // Remove estilos de posicionamento do container original
      tempContainer.style.position = 'relative'
      tempContainer.style.left = '0'
      tempContainer.style.top = '0'
      
      // Aplica rotação 90 graus
      tempContainer.style.transform = 'rotate(90deg)'
      tempContainer.style.transformOrigin = 'center center'
      
      // Aguarda aplicação da transformação
      await new Promise(resolve => setTimeout(resolve, 300))
      
      console.log('Dimensões do wrapper (para captura):', { 
        width: rotationWrapper.offsetWidth, 
        height: rotationWrapper.offsetHeight 
      })
      
      // Gera imagem do wrapper completo
      const dataUrl = await domtoimage.toPng(rotationWrapper, {
        quality: 1,
        bgcolor: '#ffffff',
        width: originalHeight,
        height: originalWidth,
      })
      
      // Remove elementos temporários
      document.body.removeChild(rotationWrapper)
      
      // Cria PDF em tamanho A3
      const img = new Image()
      img.src = dataUrl
      await new Promise((resolve) => { img.onload = resolve })
      
      // Formato A3 (297 x 420 mm) em portrait (vertical)
      const pdf = new jsPDF('p', 'mm', 'a3')
      const pageWidth = pdf.internal.pageSize.getWidth()   // 297mm
      const pageHeight = pdf.internal.pageSize.getHeight() // 420mm
      
      console.log('Dimensões PDF A3:', { pageWidth, pageHeight })
      console.log('Dimensões da imagem:', { width: img.width, height: img.height })
      
      // Calcula escala para MÁXIMO aproveitamento do espaço (margem mínima)
      const margin = 2
      const availableWidth = pageWidth - (margin * 2)
      const availableHeight = pageHeight - (margin * 2)
      
      const scale = Math.min(availableWidth / img.width, availableHeight / img.height)
      const scaledWidth = img.width * scale
      const scaledHeight = img.height * scale
      
      // Centraliza na página
      const x = (pageWidth - scaledWidth) / 2
      const y = (pageHeight - scaledHeight) / 2
      
      console.log('Posição e escala:', { x, y, scaledWidth, scaledHeight, scale })
      
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
        {/* Header */}
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
              Faça upload da planilha e selecione o local para gerar a alocação
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Upload Area */}
              <div className="space-y-2">
                <Label>Arquivo da Planilha *</Label>
                <div
                  ref={dragOverRef}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className="relative border-2 border-dashed border-border rounded-lg p-8 transition-colors cursor-pointer hover:border-primary/50 hover:bg-primary/5"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="rounded-full bg-primary/10 p-3">
                      <Upload className="h-6 w-6 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold">Arraste o arquivo aqui ou clique para selecionar</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Aceita CSV ou Excel (máximo 5MB)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Arquivo Selecionado */}
                {arquivoSelecionado && (
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="text-green-600">✓</div>
                      <div>
                        <p className="text-sm font-medium text-green-900">{arquivoSelecionado.name}</p>
                        <p className="text-xs text-green-700">
                          {(arquivoSelecionado.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setArquivoSelecionado(null)}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Local Selection */}
              <div className="space-y-2">
                <Label htmlFor="local-id">Local *</Label>
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
              </div>

              {/* Error Alert */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || !localId || !arquivoSelecionado}
                size="lg"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Processando...
                  </>
                ) : (
                  "Gerar Alocação"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Results - TODAS as funcionalidades preservadas */}
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

            {/* Seat Map - AGORA USA O COMPONENTE COM DRAG & DROP */}
            {result.alocacao?.detalhes && (
              <Card className="shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Mapa de Assentos</CardTitle>
                    <CardDescription>Clique em uma turma e arraste para outro local</CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleDownload}
                    disabled={loadingPdf}
                  >
                    {loadingPdf ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-foreground mr-2" />
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
                <CardContent>
                  <SeatMapDragDrop 
                    details={result.alocacao.detalhes} 
                    assentosVazios={result.alocacao.assentos_vazios || []}
                    onStateChange={handleSeatMapStateChange}
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