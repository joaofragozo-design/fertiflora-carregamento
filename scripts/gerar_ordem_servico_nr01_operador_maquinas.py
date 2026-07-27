# -*- coding: utf-8 -*-
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    ListFlowable, ListItem, Image, HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY

LOGO_PATH = r"C:\Projetos\FertiFloraCarregamento\scripts\logo_cropped.png"
OUTPUT_PATH = r"C:\Projetos\FertiFloraCarregamento\ORDEM_SERVICO_NR01_OPERADOR_MAQUINAS.pdf"

AZUL = colors.HexColor("#1F3864")
LARANJA = colors.HexColor("#ED7D31")
CINZA = colors.HexColor("#595959")

styles = getSampleStyleSheet()

style_empresa = ParagraphStyle(
    "Empresa", parent=styles["Normal"], fontName="Helvetica-Bold",
    fontSize=12, textColor=AZUL, leading=14,
)
style_endereco = ParagraphStyle(
    "Endereco", parent=styles["Normal"], fontName="Helvetica",
    fontSize=8.5, textColor=CINZA, leading=11,
)
style_titulo = ParagraphStyle(
    "TituloRelatorio", parent=styles["Normal"], fontName="Helvetica-Bold",
    fontSize=14.5, textColor=AZUL, leading=18, alignment=TA_CENTER,
    spaceBefore=14, spaceAfter=2,
)
style_subtitulo = ParagraphStyle(
    "Subtitulo", parent=styles["Normal"], fontName="Helvetica-Bold",
    fontSize=10, textColor=LARANJA, leading=13, alignment=TA_CENTER,
    spaceAfter=4,
)
style_secao = ParagraphStyle(
    "Secao", parent=styles["Normal"], fontName="Helvetica-Bold",
    fontSize=11.5, textColor=colors.white, leading=14,
    spaceBefore=0, spaceAfter=0, leftIndent=6,
)
style_subsecao = ParagraphStyle(
    "Subsecao", parent=styles["Normal"], fontName="Helvetica-Bold",
    fontSize=10, textColor=AZUL, leading=13, spaceBefore=6, spaceAfter=3,
)
style_corpo = ParagraphStyle(
    "Corpo", parent=styles["Normal"], fontName="Helvetica",
    fontSize=9.5, leading=13.5, alignment=TA_JUSTIFY, spaceAfter=6,
)
style_campo = ParagraphStyle(
    "Campo", parent=styles["Normal"], fontName="Helvetica",
    fontSize=10, leading=17,
)
style_bullet = ParagraphStyle(
    "Bullet", parent=styles["Normal"], fontName="Helvetica",
    fontSize=9.5, leading=13.5,
)
style_assinatura_papel = ParagraphStyle(
    "AssinaturaPapel", parent=styles["Normal"], fontName="Helvetica-Bold",
    fontSize=10, textColor=AZUL, leading=14, spaceAfter=6,
)
style_assinatura_campo = ParagraphStyle(
    "AssinaturaCampo", parent=styles["Normal"], fontName="Helvetica",
    fontSize=9.5, leading=20,
)
style_linha_label = ParagraphStyle(
    "LinhaLabel", parent=styles["Normal"], fontName="Helvetica",
    fontSize=9.5, leading=13,
)
style_rodape = ParagraphStyle(
    "Rodape", parent=styles["Normal"], fontName="Helvetica",
    fontSize=7, textColor=CINZA, alignment=TA_CENTER, leading=9,
)


def secao_titulo(texto):
    tbl = Table([[Paragraph(texto, style_secao)]], colWidths=[170 * mm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), AZUL),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    return tbl


def lista_marcadores(itens):
    return ListFlowable(
        [ListItem(Paragraph(item, style_bullet), spaceAfter=3) for item in itens],
        bulletType="bullet", start="•", leftIndent=14, bulletFontSize=8,
    )


def build_header():
    logo_w = 40 * mm
    logo_h = logo_w * (1837 / 5939)
    logo_img = Image(LOGO_PATH, width=logo_w, height=logo_h)
    empresa_texto = [
        Paragraph("FERTIFLORA FERTILIZANTES LTDA", style_empresa),
        Paragraph(
            "Rodovia PR 182, s/n – Km 05 – Vila Santa Maria — "
            "CEP: 85.825-000 – Santa Tereza do Oeste – Paraná<br/>"
            "CNPJ: 47.731.921/0001-98 &nbsp;&nbsp;|&nbsp;&nbsp; "
            "Inscrição Estadual: 909.625.63-77",
            style_endereco,
        ),
    ]
    header_tbl = Table(
        [[logo_img], [Spacer(1, 4)], [empresa_texto]],
        colWidths=[170 * mm],
    )
    header_tbl.setStyle(TableStyle([
        ("ALIGN", (0, 0), (0, 0), "LEFT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return header_tbl


def build_ficha():
    dados = [
        [Paragraph("<b>Código:</b> SST-OS-003", style_campo),
         Paragraph("<b>Revisão:</b> 00", style_campo)],
        [Paragraph("<b>Data de Emissão:</b> ____ / ____ / ________", style_campo),
         Paragraph("<b>Ordem de Serviço nº:</b> 003", style_campo)],
    ]
    tbl = Table(dados, colWidths=[85 * mm, 85 * mm])
    tbl.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.75, AZUL),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#B0BEDC")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F2F5FB")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    return tbl


def build_identificacao_colaborador():
    linha_dupla = lambda l1, v1, l2, v2: Table(
        [[Paragraph(f"<b>{l1}:</b> {v1}", style_campo),
          Paragraph(f"<b>{l2}:</b> {v2}", style_campo)]],
        colWidths=[85 * mm, 85 * mm],
        style=TableStyle([
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]),
    )
    dados = [
        [Paragraph("<b>Nome:</b> Nelson Ratis", style_campo)],
        [linha_dupla("Cargo", "Operador de Máquinas", "Setor", "Produção")],
        [Paragraph("<b>Data de Admissão:</b> ____ / ____ / ________", style_campo)],
    ]
    tbl = Table(dados, colWidths=[170 * mm])
    tbl.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#B0BEDC")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
    ]))
    return tbl


def campo_linha(label, valor=""):
    tbl = Table(
        [[Paragraph(f"<b>{label}:</b> {valor}", style_linha_label), ""]],
        colWidths=[25 * mm, 17 * mm],
    )
    tbl.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (0, 0), 3),
        ("BOTTOMPADDING", (1, 0), (1, 0), 1),
        ("LINEBELOW", (1, 0), (1, 0), 0.6, CINZA),
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
    ]))
    return tbl


def build_bloco_assinatura(papel, campos):
    """campos: lista de tuplas (label, valor_fixo_ou_None). Quando valor_fixo é
    informado, exibe como texto corrido (sem linha de preenchimento)."""
    linhas = [Paragraph(papel, style_assinatura_papel)]
    for label, valor in campos:
        if valor:
            linhas.append(Paragraph(f"<b>{label}:</b> {valor}", style_linha_label))
        else:
            linhas.append(campo_linha(label))
        linhas.append(Spacer(1, 5))
    linhas.append(Paragraph("Data: ____ / ____ / ________", style_assinatura_campo))
    tbl = Table([[linhas]], colWidths=[56 * mm])
    tbl.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#B0BEDC")),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return tbl


def build_story():
    story = []

    story.append(build_header())
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1.5, color=LARANJA))
    story.append(Spacer(1, 6))

    story.append(Paragraph("ORDEM DE SERVIÇO – SEGURANÇA E SAÚDE NO TRABALHO", style_titulo))
    story.append(Paragraph(
        "NR-01 – Disposições Gerais e Gerenciamento de Riscos Ocupacionais",
        style_subtitulo,
    ))
    story.append(Spacer(1, 6))
    story.append(build_ficha())
    story.append(Spacer(1, 14))

    # IDENTIFICAÇÃO DO COLABORADOR
    story.append(secao_titulo("IDENTIFICAÇÃO DO COLABORADOR"))
    story.append(Spacer(1, 8))
    story.append(build_identificacao_colaborador())
    story.append(Spacer(1, 10))

    # 1. OBJETIVO
    story.append(secao_titulo("1. OBJETIVO"))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "Esta Ordem de Serviço tem como objetivo estabelecer orientações de Segurança e "
        "Saúde no Trabalho para o colaborador que exerce a função de Operador de Máquinas "
        "na Fertiflora Fertilizantes Ltda., conforme estabelecido pela Norma Regulamentadora "
        "nº 01 (NR-01), apresentando os riscos ocupacionais existentes, medidas preventivas, "
        "responsabilidades e procedimentos necessários para execução segura das atividades.",
        style_corpo,
    ))
    story.append(Spacer(1, 6))

    # 2. DESCRIÇÃO DAS ATIVIDADES
    story.append(secao_titulo("2. DESCRIÇÃO DAS ATIVIDADES"))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "O Operador de Máquinas é responsável pela operação, acompanhamento e inspeção dos "
        "equipamentos utilizados no processo produtivo de fertilizantes, podendo executar as "
        "seguintes atividades:", style_corpo,
    ))
    story.append(lista_marcadores([
        "Operar equipamentos da linha de produção de fertilizantes;",
        "Operar granuladores, misturadores e equipamentos de processamento;",
        "Acompanhar o funcionamento de correias transportadoras;",
        "Operar elevadores, peneiras e demais equipamentos do processo produtivo;",
        "Realizar inspeções visuais antes do início das operações;",
        "Verificar condições de funcionamento dos equipamentos;",
        "Identificar ruídos, vibrações ou falhas durante a operação;",
        "Realizar ajustes operacionais conforme orientação da empresa;",
        "Auxiliar na limpeza e organização dos equipamentos;",
        "Realizar parada segura dos equipamentos quando necessário;",
        "Comunicar imediatamente falhas mecânicas ou condições inseguras;",
        "Seguir procedimentos operacionais e normas internas de segurança.",
    ]))
    story.append(Spacer(1, 6))

    # 3. PRINCIPAIS RISCOS DA FUNÇÃO
    story.append(secao_titulo("3. PRINCIPAIS RISCOS DA FUNÇÃO"))
    story.append(Spacer(1, 8))
    story.append(Paragraph("Riscos Físicos", style_subsecao))
    story.append(lista_marcadores([
        "Exposição a ruído proveniente dos equipamentos industriais;",
        "Exposição à poeira proveniente dos fertilizantes;",
        "Vibração dos equipamentos;",
        "Exposição ao calor em áreas próximas ao processo de secagem e fornalha.",
    ]))
    story.append(Paragraph("Riscos de Acidentes", style_subsecao))
    story.append(lista_marcadores([
        "Contato com partes móveis de máquinas;",
        "Prensagem ou esmagamento de membros;",
        "Enroscamento em equipamentos rotativos;",
        "Queda de materiais;",
        "Quedas ao mesmo nível;",
        "Escorregamentos devido a resíduos no piso;",
        "Acionamento inesperado de equipamentos;",
        "Falhas mecânicas durante operação;",
        "Choques contra estruturas e equipamentos.",
    ]))
    story.append(Paragraph("Riscos Ergonômicos", style_subsecao))
    story.append(lista_marcadores([
        "Permanência prolongada em posição em pé;",
        "Movimentos repetitivos;",
        "Necessidade de atenção constante durante a operação;",
        "Esforço físico eventual em ajustes e organização do setor.",
    ]))
    story.append(Spacer(1, 6))

    # 4. MEDIDAS DE SEGURANÇA
    story.append(secao_titulo("4. MEDIDAS DE SEGURANÇA"))
    story.append(Spacer(1, 8))
    story.append(Paragraph("O Operador de Máquinas deverá:", style_corpo))
    story.append(lista_marcadores([
        "Realizar inspeção do equipamento antes do início das atividades;",
        "Operar somente máquinas para as quais esteja autorizado e treinado;",
        "Nunca remover proteções de segurança dos equipamentos;",
        "Nunca realizar manutenção com máquinas em funcionamento;",
        "Realizar bloqueio e desligamento seguro quando necessário;",
        "Manter distância segura de partes móveis;",
        "Comunicar imediatamente qualquer defeito ou condição insegura;",
        "Manter o local de trabalho limpo e organizado;",
        "Respeitar placas, sinalizações e procedimentos internos;",
        "Utilizar corretamente os Equipamentos de Proteção Individual fornecidos pela "
        "empresa.",
    ]))
    story.append(Spacer(1, 6))

    # 5. PROCEDIMENTOS PROIBIDOS
    story.append(secao_titulo("5. PROCEDIMENTOS PROIBIDOS"))
    story.append(Spacer(1, 8))
    story.append(Paragraph("É proibido ao colaborador:", style_corpo))
    story.append(lista_marcadores([
        "Operar equipamentos sem autorização;",
        "Retirar proteções ou dispositivos de segurança;",
        "Fazer ajustes com máquinas em movimento;",
        "Colocar mãos ou ferramentas próximas a partes móveis;",
        "Improvisar ferramentas ou métodos de operação;",
        "Permanecer próximo a equipamentos sem necessidade;",
        "Ignorar condições inseguras identificadas.",
    ]))
    story.append(Spacer(1, 6))

    # 6. EQUIPAMENTOS DE PROTEÇÃO INDIVIDUAL (EPIs)
    story.append(secao_titulo("6. EQUIPAMENTOS DE PROTEÇÃO INDIVIDUAL (EPIs)"))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "Durante a execução das atividades, o colaborador deverá utilizar os EPIs "
        "fornecidos pela empresa, conforme orientação:", style_corpo,
    ))
    story.append(lista_marcadores([
        "Botina de segurança;",
        "Óculos de proteção;",
        "Protetor auricular;",
        "Respirador para poeiras quando aplicável;",
        "Luvas de proteção adequadas;",
        "Uniforme profissional;",
        "Capacete de segurança quando determinado.",
    ]))
    story.append(Spacer(1, 6))

    # 7. EM CASO DE EMERGÊNCIA
    story.append(secao_titulo("7. EM CASO DE EMERGÊNCIA"))
    story.append(Spacer(1, 8))
    story.append(Paragraph("O colaborador deverá:", style_corpo))
    story.append(lista_marcadores([
        "Interromper imediatamente a operação em caso de risco;",
        "Desligar o equipamento utilizando os procedimentos seguros;",
        "Comunicar o encarregado ou responsável pelo setor;",
        "Não tentar corrigir falhas mecânicas sem autorização;",
        "Auxiliar no isolamento da área quando necessário;",
        "Seguir as orientações da empresa para situações de emergência.",
    ]))
    story.append(Spacer(1, 6))

    # 8. RESPONSABILIDADES DO COLABORADOR
    story.append(secao_titulo("8. RESPONSABILIDADES DO COLABORADOR"))
    story.append(Spacer(1, 8))
    story.append(Paragraph("Declaro estar ciente de que:", style_corpo))
    story.append(lista_marcadores([
        "Recebi orientação sobre os riscos existentes na função de Operador de Máquinas;",
        "Fui instruído quanto ao uso correto dos Equipamentos de Proteção Individual;",
        "Comprometo-me a cumprir as normas internas de segurança;",
        "Comprometo-me a operar equipamentos de forma segura;",
        "Comunicarei imediatamente qualquer situação de risco;",
        "Estou ciente das responsabilidades relacionadas ao cumprimento das normas de "
        "segurança.",
    ]))
    story.append(Spacer(1, 6))

    # 9. BASE LEGAL
    story.append(secao_titulo("9. BASE LEGAL"))
    story.append(Spacer(1, 8))
    story.append(Paragraph("Este documento atende às disposições da:", style_corpo))
    story.append(lista_marcadores([
        "NR-01 – Disposições Gerais e Gerenciamento de Riscos Ocupacionais;",
        "NR-06 – Equipamentos de Proteção Individual (EPI);",
        "NR-12 – Segurança no Trabalho em Máquinas e Equipamentos;",
        "Consolidação das Leis do Trabalho – CLT.",
    ]))
    story.append(Spacer(1, 6))

    # 10. DECLARAÇÃO
    story.append(secao_titulo("10. DECLARAÇÃO"))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "Declaro que recebi as orientações constantes nesta Ordem de Serviço, compreendi "
        "os riscos relacionados às atividades de Operador de Máquinas, fui orientado quanto "
        "às medidas preventivas e ao uso correto dos Equipamentos de Proteção Individual "
        "(EPIs), comprometendo-me a cumprir integralmente as normas de segurança "
        "estabelecidas pela Fertiflora Fertilizantes Ltda.", style_corpo,
    ))
    story.append(Spacer(1, 8))

    # 11. ASSINATURAS
    assinaturas = Table(
        [[
            build_bloco_assinatura(
                "Colaborador",
                [("Nome", "Nelson Ratis"), ("Assinatura", None)],
            ),
            build_bloco_assinatura(
                "Responsável pela Orientação",
                [("Nome", None), ("Cargo", None), ("Assinatura", None)],
            ),
            build_bloco_assinatura(
                "Aprovação",
                [("Nome", None), ("Cargo", "Representante Legal / Gerente"), ("Assinatura", None)],
            ),
        ]],
        colWidths=[57 * mm, 57 * mm, 56 * mm],
    )
    assinaturas.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(KeepTogether([
        secao_titulo("11. ASSINATURAS"),
        Spacer(1, 10),
        assinaturas,
        Spacer(1, 6),
        Paragraph("<i>Aprovação — Fertiflora Fertilizantes Ltda.</i>", style_assinatura_campo),
    ]))

    return story


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#B0BEDC"))
    canvas.setLineWidth(0.5)
    canvas.line(20 * mm, 19 * mm, 190 * mm, 19 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(CINZA)
    canvas.drawString(20 * mm, 15 * mm, "FertiFlora Fertilizantes Ltda. — SST-OS-003 — Rev. 00")
    canvas.drawRightString(190 * mm, 15 * mm, f"Página {doc.page}")
    canvas.setFont("Helvetica", 6.5)
    canvas.drawCentredString(
        105 * mm, 10.5 * mm,
        "Documento interno da Fertiflora Fertilizantes Ltda. – Controle de Segurança e "
        "Saúde Ocupacional.",
    )
    canvas.drawCentredString(
        105 * mm, 7.5 * mm,
        "Revisão obrigatória sempre que houver alteração de função, processo produtivo, "
        "equipamentos utilizados ou legislação aplicável.",
    )
    canvas.restoreState()


def main():
    doc = SimpleDocTemplate(
        OUTPUT_PATH, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=15 * mm, bottomMargin=26 * mm,
        title="Ordem de Serviço NR-01 - Operador de Máquinas",
        author="FertiFlora Fertilizantes Ltda.",
    )
    story = build_story()
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(f"PDF gerado em: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
