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
OUTPUT_PATH = r"C:\Projetos\FertiFloraCarregamento\RELATORIO_MANUTENCAO_FORNALHA.pdf"

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
    fontSize=15, textColor=AZUL, leading=19, alignment=TA_CENTER,
    spaceBefore=14, spaceAfter=4,
)
style_ficha_label = ParagraphStyle(
    "FichaLabel", parent=styles["Normal"], fontName="Helvetica-Bold",
    fontSize=9, textColor=colors.white, alignment=TA_LEFT,
)
style_secao = ParagraphStyle(
    "Secao", parent=styles["Normal"], fontName="Helvetica-Bold",
    fontSize=11.5, textColor=colors.white, leading=14,
    spaceBefore=0, spaceAfter=0, leftIndent=6,
)
style_corpo = ParagraphStyle(
    "Corpo", parent=styles["Normal"], fontName="Helvetica",
    fontSize=10, leading=14.5, alignment=TA_JUSTIFY, spaceAfter=6,
)
style_campo = ParagraphStyle(
    "Campo", parent=styles["Normal"], fontName="Helvetica",
    fontSize=10, leading=15,
)
style_campo_label = ParagraphStyle(
    "CampoLabel", parent=styles["Normal"], fontName="Helvetica-Bold",
    fontSize=10, leading=15, textColor=AZUL,
)
style_bullet = ParagraphStyle(
    "Bullet", parent=styles["Normal"], fontName="Helvetica",
    fontSize=10, leading=14.5,
)
style_assinatura_papel = ParagraphStyle(
    "AssinaturaPapel", parent=styles["Normal"], fontName="Helvetica-Bold",
    fontSize=10, textColor=AZUL, leading=14, spaceAfter=6,
)
style_assinatura_campo = ParagraphStyle(
    "AssinaturaCampo", parent=styles["Normal"], fontName="Helvetica",
    fontSize=9.5, leading=20,
)
style_rodape = ParagraphStyle(
    "Rodape", parent=styles["Normal"], fontName="Helvetica",
    fontSize=7.5, textColor=CINZA, alignment=TA_CENTER,
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


def campo_ficha(label, valor):
    return Paragraph(f"<b>{label}:</b> {valor}", style_campo)


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
        [Paragraph("<b>Código:</b> REL-MAN-001", style_campo),
         Paragraph("<b>Revisão:</b> 00", style_campo)],
        [Paragraph("<b>Data de Emissão:</b> ____ / ____ / ________", style_campo),
         Paragraph("<b>Setor:</b> Produção – Granulação", style_campo)],
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


def build_bloco_assinatura(papel, cargo_fixo=None):
    linhas = [
        Paragraph(papel, style_assinatura_papel),
        Paragraph("Nome: " + "_" * 55, style_assinatura_campo),
        Paragraph(f"Cargo: {cargo_fixo}" if cargo_fixo else "Cargo: " + "_" * 50, style_assinatura_campo),
        Paragraph("Assinatura: " + "_" * 48, style_assinatura_campo),
        Paragraph("Data: ____ / ____ / ________", style_assinatura_campo),
    ]
    tbl = Table([[linhas]], colWidths=[170 * mm])
    tbl.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#B0BEDC")),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
    ]))
    return tbl


def build_story():
    story = []

    story.append(build_header())
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1.5, color=LARANJA))
    story.append(Spacer(1, 6))

    story.append(Paragraph(
        "RELATÓRIO DE MANUTENÇÃO PREVENTIVA DA FORNALHA<br/>E INSPEÇÃO DAS CHAMINÉS",
        style_titulo,
    ))
    story.append(Spacer(1, 6))
    story.append(build_ficha())
    story.append(Spacer(1, 14))

    # 1. OBJETIVO
    story.append(secao_titulo("1. OBJETIVO"))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "O presente relatório tem por objetivo registrar a manutenção preventiva realizada na "
        "fornalha e a inspeção visual das chaminés do sistema de granulação da Fertiflora "
        "Fertilizantes Ltda., demonstrando as condições gerais dos equipamentos, contribuindo "
        "para a segurança operacional, continuidade do processo produtivo e manutenção dos "
        "registros internos da empresa.", style_corpo,
    ))
    story.append(Paragraph(
        "Este documento também marca o início do controle documental de manutenção preventiva "
        "da unidade industrial sob a gestão da Fertiflora Fertilizantes Ltda.", style_corpo,
    ))
    story.append(Spacer(1, 8))

    # 2. IDENTIFICAÇÃO DOS EQUIPAMENTOS
    story.append(secao_titulo("2. IDENTIFICAÇÃO DOS EQUIPAMENTOS"))
    story.append(Spacer(1, 8))
    story.append(campo_ficha("Equipamento Principal", "Fornalha Industrial"))
    story.append(campo_ficha("Sistema Inspecionado", "Chaminés do Sistema de Exaustão"))
    story.append(campo_ficha("Setor", "Granulação"))
    story.append(campo_ficha("Local", "Unidade Industrial Fertiflora – Santa Tereza do Oeste – PR"))
    story.append(campo_ficha("Data da Inspeção", "____ / ____ / ________"))
    story.append(Spacer(1, 8))

    # 3. DESCRIÇÃO DA MANUTENÇÃO PREVENTIVA
    story.append(secao_titulo("3. DESCRIÇÃO DA MANUTENÇÃO PREVENTIVA"))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "A Fertiflora Fertilizantes Ltda. assumiu recentemente a operação desta unidade "
        "industrial e, como parte da implantação de seu plano de manutenção preventiva, "
        "realizou a primeira manutenção programada da fornalha utilizada no processo de "
        "granulação.", style_corpo,
    ))
    story.append(Paragraph(
        "A manutenção teve como finalidade avaliar as condições gerais do equipamento, "
        "realizar os ajustes necessários e garantir condições adequadas de funcionamento e "
        "segurança operacional.", style_corpo,
    ))
    story.append(Paragraph(
        "Durante os serviços foram executadas, conforme aplicável, as seguintes atividades:",
        style_corpo,
    ))
    story.append(lista_marcadores([
        "Inspeção geral da estrutura da fornalha;",
        "Limpeza dos componentes acessíveis;",
        "Verificação do sistema de combustão;",
        "Inspeção do revestimento interno da fornalha;",
        "Verificação de possíveis desgastes estruturais;",
        "Ajustes mecânicos necessários;",
        "Reparos realizados conforme necessidade identificada durante a manutenção;",
        "Verificação das condições gerais para retorno seguro à operação;",
        "Teste operacional após conclusão dos serviços.",
    ]))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Os serviços executados foram concluídos de forma satisfatória, mantendo o "
        "equipamento em condições adequadas para operação.", style_corpo,
    ))
    story.append(Spacer(1, 8))

    # 4. INSPEÇÃO DAS CHAMINÉS
    story.append(secao_titulo("4. INSPEÇÃO DAS CHAMINÉS"))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "As chaminés pertencentes ao sistema de granulação são de instalação recente.",
        style_corpo,
    ))
    story.append(Paragraph(
        "Foi realizada inspeção visual das estruturas, sendo verificados os seguintes aspectos:",
        style_corpo,
    ))
    story.append(lista_marcadores([
        "Integridade estrutural;",
        "Fixação da estrutura;",
        "Condições gerais de conservação;",
        "Ausência de deformações aparentes;",
        "Ausência de vazamentos visíveis;",
        "Ausência de obstruções;",
        "Condições gerais de funcionamento.",
    ]))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Durante a inspeção não foram identificadas anomalias aparentes que comprometessem "
        "sua utilização.", style_corpo,
    ))
    story.append(Spacer(1, 8))

    # 5. CONCLUSÃO
    story.append(secao_titulo("5. CONCLUSÃO"))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "Após a realização da manutenção preventiva da fornalha e da inspeção visual das "
        "chaminés, verificou-se que os equipamentos apresentam condições adequadas para "
        "operação na data desta avaliação.", style_corpo,
    ))
    story.append(Paragraph(
        "Considerando que a Fertiflora Fertilizantes Ltda. assumiu recentemente a operação "
        "desta unidade industrial, este relatório registra a primeira manutenção preventiva "
        "realizada pela empresa na fornalha e a primeira inspeção formal das chaminés sob sua "
        "gestão.", style_corpo,
    ))
    story.append(Paragraph(
        "Este documento passa a integrar o histórico de manutenção preventiva da unidade, "
        "servindo como registro inicial das ações de controle e acompanhamento dos "
        "equipamentos.", style_corpo,
    ))
    story.append(Spacer(1, 8))

    # 6. EVIDÊNCIAS ANEXAS
    story.append(secao_titulo("6. EVIDÊNCIAS ANEXAS"))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "Anexar a este relatório, quando disponível:", style_corpo,
    ))
    story.append(lista_marcadores([
        "Fotografias da manutenção realizada na fornalha;",
        "Fotografias das chaminés;",
        "Fotografias dos equipamentos após conclusão dos serviços;",
        "Registros fotográficos dos reparos executados;",
        "Ordem de serviço interna, quando existente;",
        "Demais registros relacionados à manutenção.",
    ]))
    story.append(Spacer(1, 8))

    # 7. OBSERVAÇÕES
    story.append(secao_titulo("7. OBSERVAÇÕES"))
    story.append(Spacer(1, 8))
    obs_tbl = Table([[""]], colWidths=[170 * mm], rowHeights=[28 * mm])
    obs_tbl.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#B0BEDC")),
    ]))
    story.append(obs_tbl)
    story.append(Spacer(1, 10))

    # 8. RESPONSÁVEIS
    story.append(secao_titulo("8. RESPONSÁVEIS"))
    story.append(Spacer(1, 10))
    story.append(build_bloco_assinatura("Elaborado por", cargo_fixo="Responsável pela Manutenção"))
    story.append(Spacer(1, 8))
    story.append(build_bloco_assinatura("Revisado por"))
    story.append(Spacer(1, 8))
    story.append(build_bloco_assinatura("Aprovado por", cargo_fixo="Gerente Industrial"))

    return story


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#B0BEDC"))
    canvas.setLineWidth(0.5)
    canvas.line(20 * mm, 15 * mm, 190 * mm, 15 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(CINZA)
    canvas.drawCentredString(
        105 * mm, 11 * mm,
        "FertiFlora Fertilizantes Ltda. — REL-MAN-001 — Rev. 00",
    )
    canvas.drawRightString(190 * mm, 11 * mm, f"Página {doc.page}")
    canvas.restoreState()


def main():
    doc = SimpleDocTemplate(
        OUTPUT_PATH, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=15 * mm, bottomMargin=20 * mm,
        title="Relatório de Manutenção Preventiva da Fornalha e Inspeção das Chaminés",
        author="FertiFlora Fertilizantes Ltda.",
    )
    story = build_story()
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(f"PDF gerado em: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
