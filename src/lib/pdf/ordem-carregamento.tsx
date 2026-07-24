import fs from 'node:fs'
import path from 'node:path'
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { EMBALAGEM_LABEL, type Embalagem } from '@/types/formula'

// Timbre/rodapé — igual ao modelo real de "Ordem de Carregamento" que a
// Logística já usa e encaminha aos clientes/transportadoras pra preencher.
const EMPRESA = {
  nome:     'FERTIFLORA FERTILIZANTES LTDA',
  endereco: 'ROD. PR 317, KM 05 - S/N - ZONA RURAL',
}

// Lê o arquivo como Buffer (em vez de passar o path pro <Image>) porque
// @react-pdf/image resolve path local com url.parse(), que quebra em paths
// do Windows (barra invertida + "C:" viram host/protocol inválidos) e cai
// silenciosamente no branch de fetch remoto — a logo some sem erro nenhum.
// Buffer pula esse parsing inteiramente (funciona igual em qualquer SO).
const LOGO_BUFFER = fs.readFileSync(path.join(process.cwd(), 'public', 'fertiflora-logo.png'))

const styles = StyleSheet.create({
  page:          { padding: 20, fontSize: 8, fontFamily: 'Helvetica', color: '#111' },
  outer:         { flex: 1, border: '1.5 solid #000', padding: 12 },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1 solid #000', paddingBottom: 8, marginBottom: 8 },
  logo:          { width: 100 },
  headerTitulo:  { alignItems: 'center', flex: 1 },
  titulo:        { fontSize: 13, fontWeight: 700 },
  numero:        { fontSize: 9, fontWeight: 700, color: '#1b5e20', marginTop: 2 },

  secaoTitulo:   { backgroundColor: '#d9ead3', border: '0.5 solid #000', borderBottom: 'none', paddingVertical: 3, paddingHorizontal: 5, fontSize: 8, fontWeight: 700, marginTop: 8 },

  tableHeaderRow:{ flexDirection: 'row', backgroundColor: '#d9ead3' },
  tableRow:      { flexDirection: 'row' },
  th:            { fontSize: 7, fontWeight: 700, border: '0.5 solid #000', padding: 3, textAlign: 'center' },
  td:            { fontSize: 7.5, border: '0.5 solid #000', padding: 3 },
  colPedido:     { width: '9%' },
  colCliente:    { width: '18%' },
  colDestino:    { width: '15%' },
  colProduto:    { width: '26%' },
  colEmb:        { width: '12%', textAlign: 'center' },
  colQtd:        { width: '10%', textAlign: 'center' },
  colPeso:       { width: '10%', textAlign: 'right' },
  totalRow:      { flexDirection: 'row', justifyContent: 'flex-end' },
  totalLabel:    { fontSize: 7.5, fontWeight: 700, border: '0.5 solid #000', borderTop: 'none', padding: 3, width: '10%', textAlign: 'right' },

  formRow:       { flexDirection: 'row', borderLeft: '0.5 solid #000', borderRight: '0.5 solid #000', borderBottom: '0.5 solid #000' },
  campoLabel:    { fontSize: 7, fontWeight: 700, padding: 3, backgroundColor: '#f2f2f2', borderRight: '0.5 solid #000', width: 90 },
  campoValor:    { fontSize: 7.5, padding: 3, flex: 1, borderRight: '0.5 solid #000' },
  campoValorFim: { fontSize: 7.5, padding: 3, flex: 1 },

  obsBox:        { border: '0.5 solid #000', borderTop: 'none', padding: 6 },
  obsTexto:      { fontSize: 7.5, marginBottom: 4 },
  regraTitulo:   { fontSize: 7.5, fontWeight: 700, marginTop: 2 },
  regraItem:     { fontSize: 7, marginTop: 2 },

  rodape:        { textAlign: 'center', marginTop: 10, fontSize: 7.5, fontWeight: 700 },
})

interface ItemOrdem {
  produto:   string // fórmula mascarada (nunca a composição completa)
  destino:   string // ainda não rastreado no sistema — fica em branco
  embalagem: Embalagem
  quantidade: number
  tons:      number
}

export interface OrdemCarregamentoInput {
  numeroOrdem:        number
  data:               string // YYYY-MM-DD
  pedido:             number | null // "número do pedido" (cliente_codigo)
  cliente:            string
  itens:              ItemOrdem[]
  transportadoraNome: string
  transportadoraCnpj: string | null
  motoristaNome:      string
  motoristaCpf:       string
  motoristaRg:        string
  motoristaCnh:       string
  motoristaWhatsapp:  string
  placaCavalo:        string
  placasCarreta:      string[] // placa_1..4, já filtradas
  liberadoEm:         string   // ISO
  liberadoPor:        string
  observacao:         string
}

function Campo({ label, valor, ultimo }: { label: string; valor: string; ultimo?: boolean }) {
  return (
    <>
      <Text style={styles.campoLabel}>{label}</Text>
      <Text style={ultimo ? styles.campoValorFim : styles.campoValor}>{valor || ' '}</Text>
    </>
  )
}

function OrdemCarregamentoDocument({ input }: { input: OrdemCarregamentoInput }) {
  const dataFormatada = new Date(input.data + 'T12:00:00').toLocaleDateString('pt-BR')
  const liberadoEmFormatado = new Date(input.liberadoEm).toLocaleDateString('pt-BR')
  const totalTons = input.itens.reduce((s, it) => s + it.tons, 0)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.outer}>
          <View style={styles.header}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={LOGO_BUFFER} style={styles.logo} />
            <View style={styles.headerTitulo}>
              <Text style={styles.titulo}>ORDEM DE CARREGAMENTO</Text>
              <Text style={styles.numero}>Nº {String(input.numeroOrdem).padStart(6, '0')}</Text>
            </View>
            <View style={{ width: 100 }} />
          </View>

          {/* 1) Dados do pedido */}
          <Text style={styles.secaoTitulo}>1) Dados do pedido:</Text>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colPedido]}>Pedido</Text>
            <Text style={[styles.th, styles.colCliente]}>Cliente</Text>
            <Text style={[styles.th, styles.colDestino]}>Destino</Text>
            <Text style={[styles.th, styles.colProduto]}>Produto</Text>
            <Text style={[styles.th, styles.colEmb]}>Embalagens</Text>
            <Text style={[styles.th, styles.colQtd]}>Quantidade</Text>
            <Text style={[styles.th, styles.colPeso]}>Peso (ton)</Text>
          </View>
          {input.itens.map((it, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.td, styles.colPedido]}>{input.pedido ?? '—'}</Text>
              <Text style={[styles.td, styles.colCliente]}>{input.cliente || '—'}</Text>
              <Text style={[styles.td, styles.colDestino]}>{it.destino || ' '}</Text>
              <Text style={[styles.td, styles.colProduto]}>{it.produto}</Text>
              <Text style={[styles.td, styles.colEmb]}>{EMBALAGEM_LABEL[it.embalagem]}</Text>
              <Text style={[styles.td, styles.colQtd]}>{it.quantidade}</Text>
              <Text style={[styles.td, styles.colPeso]}>{it.tons.toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{totalTons.toFixed(2)}</Text>
          </View>

          {/* 2) Dados do Transportador */}
          <Text style={styles.secaoTitulo}>2) Dados do Transportador</Text>
          <View style={styles.formRow}>
            <Campo label="Motorista:" valor={input.motoristaNome} />
            <Campo label="CPF:" valor={input.motoristaCpf} />
            <Campo label="TELEFONE:" valor={input.motoristaWhatsapp} ultimo />
          </View>
          <View style={styles.formRow}>
            <Campo label="Placa (cavalo):" valor={input.placaCavalo} />
            <Campo label="RG:" valor={input.motoristaRg} ultimo />
          </View>
          {input.placasCarreta.length > 0 ? (
            input.placasCarreta.map((placa, i) => (
              <View key={i} style={styles.formRow}>
                <Campo label="Placa(s) Carreta(s):" valor={placa} />
                {i === 0 ? <Campo label="CNH:" valor={input.motoristaCnh} ultimo /> : <View style={{ flex: 1 }} />}
              </View>
            ))
          ) : (
            <View style={styles.formRow}>
              <Campo label="Placa(s) Carreta(s):" valor="" />
              <Campo label="CNH:" valor={input.motoristaCnh} ultimo />
            </View>
          )}
          <View style={styles.formRow}>
            <Campo label="RNTRC (Veículo):" valor="" ultimo />
          </View>

          {/* 3) Dados da Transportadora */}
          <Text style={styles.secaoTitulo}>3) Dados da Transportadora</Text>
          <View style={styles.formRow}>
            <Campo label="Razão Social:" valor={input.transportadoraNome} />
            <Campo label="CNPJ:" valor={input.transportadoraCnpj ?? ''} ultimo />
          </View>
          <View style={styles.formRow}>
            <Campo label="Endereço:" valor="" />
            <Campo label="TELEFONE:" valor="" ultimo />
          </View>
          <View style={styles.formRow}>
            <Campo label="RNTRC (Transp.):" valor="" />
            <Campo label="CIDADE:" valor="" ultimo />
          </View>

          <View style={styles.formRow}>
            <Campo label="Responsavel:" valor={input.liberadoPor} />
            <Campo label="Data:" valor={liberadoEmFormatado} ultimo />
          </View>

          {/* Observações */}
          <Text style={styles.secaoTitulo}>Observações:</Text>
          <View style={styles.obsBox}>
            {input.observacao ? <Text style={styles.obsTexto}>{input.observacao}</Text> : null}
            <Text style={styles.obsTexto}>A autorização de carregamento será aceito por:</Text>
            <Text style={styles.regraItem}>- E-mail: Domínio do cliente;</Text>
            <Text style={styles.regraItem}>- Em mãos: assinada e carimbada pelo responsável;</Text>
            <Text style={styles.regraItem}>- Item 01: Preencher todos os campos;</Text>
            <Text style={styles.regraItem}>- Item 02: Preencher todos os campos somente quando for Autônomo;</Text>
            <Text style={styles.regraItem}>- Item 03: Preencher todos os campos somente quando for Transportadora.</Text>
          </View>

          <Text style={styles.rodape}>{EMPRESA.nome}</Text>
          <Text style={styles.rodape}>{EMPRESA.endereco}</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function gerarPdfOrdemCarregamento(input: OrdemCarregamentoInput): Promise<Buffer> {
  return renderToBuffer(<OrdemCarregamentoDocument input={input} />)
}
