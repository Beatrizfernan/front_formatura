
"use client"

import React, { useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Trash2, AlertCircle, Check, ArrowLeft, Armchair, ArrowUp, ArrowDown, Edit2 } from 'lucide-react';
import { API_URL } from '../layout';

interface Fila {
  id: number;
  nome: string;
  quantidade_assentos: number;
  ordem: number;
}

export default function CriarLocal() {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [filas, setFilas] = useState<Fila[]>([
    { id: 1, nome: '1A', quantidade_assentos: 10, ordem: 1 }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [nextId, setNextId] = useState(2);
  const [editandoFila, setEditandoFila] = useState<number | null>(null);
  const [novaFilaNome, setNovaFilaNome] = useState('');
  const [novaFilaAssentos, setNovaFilaAssentos] = useState('10');
  const [mostrarFormNova, setMostrarFormNova] = useState(false);

  const calcularOrdem = (nomeFila: string, filasExistentes: Fila[]): number => {
    // Cria uma lista temporária com a nova fila
    const todasFilas = [...filasExistentes.map(f => f.nome), nomeFila];
    
    // Ordena por número da linha primeiro, depois por letra
    const filasOrdenadas = todasFilas.sort((a, b) => {
      const matchA = a.match(/^(\d+)([A-Z])$/);
      const matchB = b.match(/^(\d+)([A-Z])$/);
      
      if (!matchA || !matchB) return 0;
      
      const numA = parseInt(matchA[1]);
      const numB = parseInt(matchB[1]);
      
      // Se são da mesma linha, ordena por letra
      if (numA === numB) {
        return matchA[2].localeCompare(matchB[2]);
      }
      
      // Senão, ordena por número da linha
      return numA - numB;
    });
    
    // Retorna a posição (1-based) da fila na lista ordenada
    return filasOrdenadas.indexOf(nomeFila) + 1;
  };

  const gerarProximoNomeFila = () => {
    if (filas.length === 0) return '1A';
    
    const filasOrdenadas = [...filas].sort((a, b) => a.ordem - b.ordem);
    const ultimaFila = filasOrdenadas[filasOrdenadas.length - 1];
    
    const match = ultimaFila.nome.match(/^(\d+)([A-Z])$/);
    if (!match) return '1A';
    
    const numero = parseInt(match[1]);
    const letra = match[2];
    const proximaLetra = String.fromCharCode(letra.charCodeAt(0) + 1);
    
    if (proximaLetra <= 'Z') {
      return `${numero}${proximaLetra}`;
    }
    
    return `${numero + 1}A`;
  };

  const adicionarFilaRapida = () => {
    const novoNome = gerarProximoNomeFila();
    const novaOrdem = calcularOrdem(novoNome, filas);
    
    setFilas([
      ...filas,
      { id: nextId, nome: novoNome, quantidade_assentos: 10, ordem: novaOrdem }
    ]);
    setNextId(nextId + 1);
  };

  const adicionarFilaPersonalizada = () => {
    const nomeNormalizado = novaFilaNome.trim().toUpperCase();
    
    // Validações
    const padraoFila = /^[0-9]+[A-Z]$/;
    if (!padraoFila.test(nomeNormalizado)) {
      setError('Nome da fila deve seguir o padrão número+letra (ex: 1A, 2B, 3A)');
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (filas.some(f => f.nome === nomeNormalizado)) {
      setError(`Já existe uma fila com o nome "${nomeNormalizado}"`);
      setTimeout(() => setError(null), 3000);
      return;
    }

    const assentos = parseInt(novaFilaAssentos);
    if (assentos < 1 || assentos > 100) {
      setError('Quantidade de assentos deve estar entre 1 e 100');
      setTimeout(() => setError(null), 3000);
      return;
    }

    const novaOrdem = calcularOrdem(nomeNormalizado, filas);
    
    setFilas([
      ...filas,
      { id: nextId, nome: nomeNormalizado, quantidade_assentos: assentos, ordem: novaOrdem }
    ]);
    setNextId(nextId + 1);
    
    // Limpar formulário
    setNovaFilaNome('');
    setNovaFilaAssentos('10');
    setMostrarFormNova(false);
  };

  const removerFila = (id: number) => {
    if (filas.length === 1) {
      setError('O local deve ter pelo menos uma fila');
      setTimeout(() => setError(null), 3000);
      return;
    }
    
    setFilas(filas.filter(f => f.id !== id));
  };

  const moverFila = (id: number, direcao: 'up' | 'down') => {
    const filasOrdenadas = [...filas].sort((a, b) => a.ordem - b.ordem);
    const index = filasOrdenadas.findIndex(f => f.id === id);
    
    if (index === -1) return;
    if ((direcao === 'up' && index === 0) || 
        (direcao === 'down' && index === filasOrdenadas.length - 1)) {
      return;
    }
    
    const targetIndex = direcao === 'up' ? index - 1 : index + 1;
    
    const novaOrdemAtual = filasOrdenadas[targetIndex].ordem;
    const novaOrdemTarget = filasOrdenadas[index].ordem;
    
    setFilas(filas.map(f => {
      if (f.id === id) return { ...f, ordem: novaOrdemAtual };
      if (f.id === filasOrdenadas[targetIndex].id) return { ...f, ordem: novaOrdemTarget };
      return f;
    }));
  };

  const atualizarFila = (id: number, campo: keyof Fila, valor: string | number) => {
    if (campo === 'nome') {
      const nomeNormalizado = String(valor).trim().toUpperCase();
      const padraoFila = /^[0-9]+[A-Z]$/;
      
      if (!padraoFila.test(nomeNormalizado)) {
        setError('Nome da fila deve seguir o padrão número+letra (ex: 1A, 2B)');
        setTimeout(() => setError(null), 3000);
        return;
      }

      if (filas.some(f => f.nome === nomeNormalizado && f.id !== id)) {
        setError(`Já existe uma fila com o nome "${nomeNormalizado}"`);
        setTimeout(() => setError(null), 3000);
        return;
      }

      const novaOrdem = calcularOrdem(nomeNormalizado, filas.filter(f => f.id !== id));
      setFilas(filas.map(f => 
        f.id === id ? { ...f, nome: nomeNormalizado, ordem: novaOrdem } : f
      ));
    } else {
      setFilas(filas.map(f => 
        f.id === id ? { ...f, [campo]: valor } : f
      ));
    }
  };

  const validarFormulario = () => {
    if (!nome.trim()) {
      setError('Nome do local é obrigatório');
      return false;
    }

    if (nome.trim().length < 3) {
      setError('Nome deve ter pelo menos 3 caracteres');
      return false;
    }

    for (const fila of filas) {
      if (!fila.nome.trim()) {
        setError('Todas as filas devem ter um nome');
        return false;
      }

      if (fila.quantidade_assentos < 1 || fila.quantidade_assentos > 100) {
        setError('Quantidade de assentos deve estar entre 1 e 100');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(false);

    if (!validarFormulario()) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/criar_local`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nome: nome.trim(),
          descricao: descricao.trim(),
          filas: filas.map(f => ({
            nome: f.nome.trim().toUpperCase(),
            quantidade_assentos: parseInt(String(f.quantidade_assentos)),
            ordem: f.ordem
          }))
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar local');
      }

      setSuccess(true);
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const totalAssentos = filas.reduce((sum, f) => sum + (parseInt(String(f.quantidade_assentos)) || 0), 0);
  const filasOrdenadas = [...filas].sort((a, b) => a.ordem - b.ordem);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Criar Novo Local</h1>
            <p className="text-muted-foreground">Configure o local e suas filas de assentos</p>
          </div>
        </div>

        {success && (
          <Alert className="bg-green-50 text-green-900 border-green-200">
            <Check className="h-4 w-4" />
            <AlertDescription>
              Local criado com sucesso! Redirecionando...
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuração */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações do Local</CardTitle>
                <CardDescription>Dados básicos sobre o local</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome do Local *</Label>
                  <Input
                    id="nome"
                    placeholder="Ex: Auditório Principal"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição (Opcional)</Label>
                  <textarea
                    id="descricao"
                    placeholder="Informações adicionais..."
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    disabled={loading}
                    rows={3}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Configurar Filas</CardTitle>
                    <CardDescription>Adicione filas na ordem que desejar</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={adicionarFilaRapida}
                      disabled={loading}
                      title="Adiciona próxima fila sequencial"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Próxima
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => setMostrarFormNova(!mostrarFormNova)}
                      disabled={loading}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Personalizar
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Formulário Nova Fila Personalizada */}
                {mostrarFormNova && (
                  <div className="p-4 border border-primary rounded-lg bg-primary/5 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Nome da Fila</Label>
                        <Input
                          placeholder="Ex: 2A, 3B"
                          value={novaFilaNome}
                          onChange={(e) => setNovaFilaNome(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Assentos</Label>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={novaFilaAssentos}
                          onChange={(e) => setNovaFilaAssentos(e.target.value)}
                          className="h-9"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={adicionarFilaPersonalizada}
                        className="flex-1"
                      >
                        Adicionar Fila
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setMostrarFormNova(false);
                          setNovaFilaNome('');
                          setNovaFilaAssentos('10');
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}

                <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
                  {filasOrdenadas.map((fila, index) => (
                    <div
                      key={fila.id}
                      className="group relative p-3 border rounded-lg bg-muted/30 hover:border-primary/50 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        {/* Controles de Ordem */}
                        <div className="flex flex-col gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 p-0"
                            onClick={() => moverFila(fila.id, 'up')}
                            disabled={index === 0}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 p-0"
                            onClick={() => moverFila(fila.id, 'down')}
                            disabled={index === filasOrdenadas.length - 1}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Badge da Fila */}
                        <div className="flex items-center justify-center w-12 h-12 rounded-md bg-primary/10 text-primary font-bold text-lg">
                          {fila.nome}
                        </div>

                        {/* Informações e Edição */}
                        <div className="flex-1">
                          {editandoFila === fila.id ? (
                            <div className="space-y-2">
                              <Input
                                value={fila.nome}
                                onChange={(e) => atualizarFila(fila.id, 'nome', e.target.value)}
                                className="h-8 mb-1"
                                placeholder="Ex: 2A"
                              />
                              <Input
                                type="number"
                                min="1"
                                max="100"
                                value={fila.quantidade_assentos}
                                onChange={(e) => atualizarFila(fila.id, 'quantidade_assentos', parseInt(e.target.value) || 10)}
                                className="h-8"
                                placeholder="Quantidade de assentos"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-xs"
                                onClick={() => setEditandoFila(null)}
                              >
                                Concluir
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">Fila {fila.nome}</div>
                                <div className="text-sm text-muted-foreground">
                                  {fila.quantidade_assentos} assentos
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => setEditandoFila(fila.id)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Botão Remover */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removerFila(fila.id)}
                          disabled={filas.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3 border-t">
                  <span className="text-sm text-muted-foreground">
                    {filas.length} fila(s)
                  </span>
                  <span className="text-sm font-medium">
                    Total: <span className="text-xl text-primary">{totalAssentos}</span> assentos
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview Visual */}
          <div className="space-y-6">
            <Card className="lg:sticky lg:top-6">
              <CardHeader>
                <CardTitle>Preview do Layout</CardTitle>
                <CardDescription>Visualização das filas de assentos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-gradient-to-b from-primary/20 to-transparent p-4 rounded-t-lg text-center">
                    <div className="text-sm font-medium text-primary">PALCO / FRENTE</div>
                  </div>

                  <div className="space-y-4 max-h-[500px] overflow-y-auto px-2">
                    {filas.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Armchair className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p>Nenhuma fila adicionada</p>
                      </div>
                    ) : (
                      (() => {
                        const filasPorLinha = filasOrdenadas.reduce((acc, fila) => {
                          const match = fila.nome.match(/^(\d+)([A-Z])$/);
                          if (match) {
                            const linha = match[1];
                            if (!acc[linha]) acc[linha] = [];
                            acc[linha].push(fila);
                          }
                          return acc;
                        }, {} as Record<string, Fila[]>);

                        return Object.entries(filasPorLinha)
                          .sort(([a], [b]) => parseInt(a) - parseInt(b))
                          .map(([linha, filasLinha]) => (
                            <div key={linha} className="space-y-2">
                              <div className="text-xs font-medium text-muted-foreground px-2">
                                Linha {linha}
                              </div>
                              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${filasLinha.length}, 1fr)` }}>
                                {filasLinha.map((fila) => (
                                  <div key={fila.id} className="space-y-2">
                                    <div className="text-center">
                                      <span className="text-xs font-medium text-primary block">
                                        Fila {fila.nome}
                                      </span>
                                      <span className="text-xs text-muted-foreground block">
                                        {fila.quantidade_assentos} assentos
                                      </span>
                                    </div>
                                    <div className="overflow-x-auto">
                                      <div className="flex gap-1.5 p-3 bg-muted/50 rounded-lg border justify-center min-w-max">
                                        {Array.from({ length: fila.quantidade_assentos }).map((_, i) => (
                                          <div
                                            key={i}
                                            className="flex items-center justify-center w-8 h-8 rounded bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors flex-shrink-0"
                                            title={`${fila.nome}-${i + 1}`}
                                          >
                                            <Armchair className="h-4 w-4" />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ));
                      })()
                    )}
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total de Filas:</span>
                      <span className="font-medium">{filas.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total de Assentos:</span>
                      <span className="font-bold text-lg text-primary">{totalAssentos}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-4 lg:col-span-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => window.history.back()}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={handleSubmit}
            disabled={loading || filas.length === 0}
          >
            {loading ? 'Criando...' : 'Criar Local'}
          </Button>
        </div>
      </div>
    </div>
  );
}