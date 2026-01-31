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

  interface DomToImageOptions {
    quality?: number;
    bgcolor?: string;
    scale?: number;
    width?: number;
    height?: number;
    style?: Record<string, string>;
  }
  
  const handleDownload = async () => {
    if (!result || !result.formatura?.id) {
      setError('Dados da formatura não disponíveis');
      return;
    }

    setLoadingPdf(true);
    
    try {
      const formaturaId = result.formatura.id;
      
      // Chama endpoint do backend
      const response = await fetch(
        `${API_URL}/api/pdf/mapa-assentos/${formaturaId}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/pdf',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao gerar PDF');
      }

      // Converte resposta em blob
      const blob = await response.blob();
      
      // Cria URL temporária para download
      const url = window.URL.createObjectURL(blob);
      
      // Cria link de download
      const link = document.createElement('a');
      link.href = url;
      link.download = `mapa-assentos-${result.formatura.nome.replace(/\s+/g, '-')}.pdf`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error('Erro ao baixar PDF:', err);
      setError(
        err instanceof Error 
          ? err.message 
          : 'Não foi possível gerar o PDF. Tente novamente.'
      );
      
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoadingPdf(false);
    }
  };

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