export interface FilaDetail {
  fila: string
  assentos: number
  range: string
}

export interface AllocationDetail {
  curso: string
  total_assentos: number
  filas: FilaDetail[]
}

export interface AssentosVazios {
  fila: string
  assentos_vazios: number[]
  total_vazios: number
}

export interface Alocacao {
  id: string
  total_alocado: number
  taxa_ocupacao: string
  detalhes: AllocationDetail[]
  assentos_vazios?: AssentosVazios[]
}

export interface Formatura {
  id: string
  nome: string
  data: string
  local: string
  total_formandos: number
  total_assentos: number
}

export interface Processamento {
  cursos_criados: string[]
  cursos_existentes: string[]
  total_cursos: number
}

export interface AllocationResponse {
  success: boolean
  message: string
  processamento: Processamento
  formatura: Formatura
  alocacao: Alocacao
}
