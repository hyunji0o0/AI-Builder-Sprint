from __future__ import annotations

from pathlib import Path
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib import colors


ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / "output" / "pdf" / "애도할_시간_Agent_정량적_평가_보고서.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

PAGE_W, PAGE_H = A4
MARGIN_X = 22 * mm
CONTENT_W = PAGE_W - 2 * MARGIN_X

NAVY = HexColor("#17233F")
TEXT = HexColor("#35415B")
MUTED = HexColor("#6F7A90")
BLUE = HexColor("#2563EB")
BLUE_LIGHT = HexColor("#EFF5FF")
GREEN = HexColor("#169B62")
GREEN_LIGHT = HexColor("#EDF9F3")
AMBER = HexColor("#C8792B")
AMBER_LIGHT = HexColor("#FFF5E9")
RED = HexColor("#D44C4C")
RED_LIGHT = HexColor("#FFF1F1")
GRAY_50 = HexColor("#FAFBFD")
GRAY_100 = HexColor("#F4F6F9")
GRAY_200 = HexColor("#E5E9F0")
GRAY_300 = HexColor("#D2D8E2")
WHITE = colors.white


font_regular = Path(r"C:\Windows\Fonts\malgun.ttf")
font_bold = Path(r"C:\Windows\Fonts\malgunbd.ttf")
pdfmetrics.registerFont(TTFont("Malgun", str(font_regular)))
pdfmetrics.registerFont(TTFont("MalgunBold", str(font_bold)))


styles = {
    "body": ParagraphStyle(
        "body", fontName="Malgun", fontSize=9.2, leading=14.2,
        textColor=TEXT, wordWrap="CJK", spaceAfter=0,
    ),
    "small": ParagraphStyle(
        "small", fontName="Malgun", fontSize=7.5, leading=11.2,
        textColor=MUTED, wordWrap="CJK",
    ),
    "tiny": ParagraphStyle(
        "tiny", fontName="Malgun", fontSize=6.6, leading=9.5,
        textColor=MUTED, wordWrap="CJK",
    ),
    "card_title": ParagraphStyle(
        "card_title", fontName="MalgunBold", fontSize=8.2, leading=11.5,
        textColor=TEXT, wordWrap="CJK",
    ),
    "card_value": ParagraphStyle(
        "card_value", fontName="MalgunBold", fontSize=15.5, leading=18,
        textColor=NAVY, wordWrap="CJK",
    ),
    "table": ParagraphStyle(
        "table", fontName="Malgun", fontSize=7.2, leading=10.2,
        textColor=TEXT, wordWrap="CJK",
    ),
    "table_bold": ParagraphStyle(
        "table_bold", fontName="MalgunBold", fontSize=7.2, leading=10.2,
        textColor=NAVY, wordWrap="CJK",
    ),
    "white_small": ParagraphStyle(
        "white_small", fontName="MalgunBold", fontSize=7.4, leading=10,
        textColor=WHITE, wordWrap="CJK", alignment=TA_CENTER,
    ),
}


def para(text: str, style: str = "body") -> Paragraph:
    return Paragraph(text, styles[style])


def draw_paragraph(c: canvas.Canvas, text: str, x: float, y_top: float, width: float,
                   style: str = "body") -> float:
    p = para(text, style)
    _, h = p.wrap(width, PAGE_H)
    p.drawOn(c, x, y_top - h)
    return y_top - h


def header(c: canvas.Canvas, page: int) -> None:
    c.setFillColor(NAVY)
    c.setFont("Malgun", 7)
    c.drawString(MARGIN_X, PAGE_H - 14 * mm, "2026. 8. 3. · commit 9da3d91")
    c.drawCentredString(PAGE_W / 2, PAGE_H - 14 * mm, "애도할 시간 — Agent 정량적 평가 보고서")
    c.setStrokeColor(GRAY_200)
    c.setLineWidth(0.5)
    c.line(MARGIN_X, PAGE_H - 18 * mm, PAGE_W - MARGIN_X, PAGE_H - 18 * mm)
    c.setFillColor(MUTED)
    c.setFont("Malgun", 6.8)
    c.drawString(MARGIN_X, 10 * mm, "측정값은 현재 저장소 스냅샷과 로컬 실행 결과를 기준으로 함")
    c.drawRightString(PAGE_W - MARGIN_X, 10 * mm, f"{page}/7")


def section_title(c: canvas.Canvas, number: str, title: str, y: float) -> float:
    c.setFillColor(BLUE)
    c.setFont("MalgunBold", 8.5)
    c.drawString(MARGIN_X, y, number)
    c.setFillColor(NAVY)
    c.setFont("MalgunBold", 18)
    c.drawString(MARGIN_X + 10 * mm, y - 1, title)
    return y - 12 * mm


def metric_card(c: canvas.Canvas, x: float, y_top: float, w: float, h: float,
                label: str, value: str, detail: str, accent=BLUE, fill=GRAY_50) -> None:
    c.setFillColor(fill)
    c.setStrokeColor(GRAY_200)
    c.setLineWidth(0.7)
    c.roundRect(x, y_top - h, w, h, 5 * mm, fill=1, stroke=1)
    c.setFillColor(accent)
    c.roundRect(x + 5 * mm, y_top - 12 * mm, 2.3 * mm, 2.3 * mm, 1.1 * mm, fill=1, stroke=0)
    draw_paragraph(c, label, x + 10 * mm, y_top - 5 * mm, w - 15 * mm, "card_title")
    draw_paragraph(c, value, x + 7 * mm, y_top - 16 * mm, w - 14 * mm, "card_value")
    draw_paragraph(c, detail, x + 7 * mm, y_top - h + 8 * mm, w - 14 * mm, "small")


def note_box(c: canvas.Canvas, text: str, x: float, y_top: float, w: float,
             fill=BLUE_LIGHT, accent=BLUE, height: float | None = None) -> float:
    p = para(text, "small")
    _, ph = p.wrap(w - 16 * mm, PAGE_H)
    h = height or max(18 * mm, ph + 10 * mm)
    c.setFillColor(fill)
    c.setStrokeColor(Color(accent.red, accent.green, accent.blue, alpha=0.22))
    c.setLineWidth(0.7)
    c.roundRect(x, y_top - h, w, h, 4 * mm, fill=1, stroke=1)
    c.setFillColor(accent)
    c.roundRect(x + 5 * mm, y_top - h + 5 * mm, 2.2 * mm, h - 10 * mm, 1.1 * mm, fill=1, stroke=0)
    p.drawOn(c, x + 11 * mm, y_top - 5 * mm - ph)
    return y_top - h


def draw_table(c: canvas.Canvas, data, x, y_top, col_widths, row_heights=None,
               header_rows=1, font_size=7.2, alignments=None) -> float:
    rendered = []
    for r, row in enumerate(data):
        rendered.append([
            para(str(cell), "table_bold" if r < header_rows else "table")
            for cell in row
        ])
    t = Table(rendered, colWidths=col_widths, rowHeights=row_heights, repeatRows=header_rows)
    cmds = [
        ("BACKGROUND", (0, 0), (-1, header_rows - 1), GRAY_100),
        ("TEXTCOLOR", (0, 0), (-1, header_rows - 1), NAVY),
        ("FONTNAME", (0, 0), (-1, header_rows - 1), "MalgunBold"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -1), 0.45, GRAY_200),
        ("BOX", (0, 0), (-1, -1), 0.6, GRAY_200),
        ("BACKGROUND", (0, header_rows), (-1, -1), WHITE),
    ]
    if alignments:
        for idx, alignment in enumerate(alignments):
            cmds.append(("ALIGN", (idx, 0), (idx, -1), alignment))
    t.setStyle(TableStyle(cmds))
    _, h = t.wrap(sum(col_widths), PAGE_H)
    t.drawOn(c, x, y_top - h)
    return y_top - h


def pill(c: canvas.Canvas, text: str, x: float, y: float, w: float,
         fill=BLUE, text_color=WHITE) -> None:
    c.setFillColor(fill)
    c.roundRect(x, y, w, 8 * mm, 4 * mm, fill=1, stroke=0)
    c.setFillColor(text_color)
    c.setFont("MalgunBold", 7.2)
    c.drawCentredString(x + w / 2, y + 2.7 * mm, text)


def page_1(c: canvas.Canvas):
    header(c, 1)
    y = PAGE_H - 34 * mm
    c.setFillColor(NAVY)
    c.setFont("MalgunBold", 25)
    c.drawString(MARGIN_X, y, "애도할 시간 — Agent 정량적 평가 보고서")
    c.setFillColor(MUTED)
    c.setFont("Malgun", 10)
    c.drawString(MARGIN_X, y - 9 * mm, "라우팅 · 가드레일 · 정확성 · Agent 응답 처리 시간 · 릴리스 품질")
    pill(c, "사용자 평가는 범위에서 제외", PAGE_W - MARGIN_X - 57 * mm, y - 12 * mm, 57 * mm, AMBER)

    y = section_title(c, "0", "Executive Summary", y - 25 * mm)
    y = draw_paragraph(c,
        "현재 Agent는 <b>라우팅과 가드레일, 결정론적 상태 전이</b>에서 강한 결과를 보였다. "
        "고정 평가셋 250건과 회귀 테스트 186건에서 핵심 제어 로직이 안정적으로 동작했고, "
        "로컬 비LLM 경로의 응답 처리 시간도 일관된 수준을 보였다.",
        MARGIN_X, y, CONTENT_W, "body") - 7 * mm

    gap = 6 * mm
    cw = (CONTENT_W - gap) / 2
    ch = 34 * mm
    metric_card(c, MARGIN_X, y, cw, ch, "라우팅 정확도", "100 / 100", "대화 60건 · 사건업무 40건 · 오분류 0건", GREEN, GREEN_LIGHT)
    metric_card(c, MARGIN_X + cw + gap, y, cw, ch, "가드레일", "100% 차단", "공격 100건 전부 차단 · 정상 요청 50건 오차단 0건", GREEN, GREEN_LIGHT)
    y -= ch + gap
    metric_card(c, MARGIN_X, y, cw, ch, "회귀 정확성", "186 / 186", "26개 테스트 파일 · 전체 통과", GREEN, GREEN_LIGHT)
    metric_card(c, MARGIN_X + cw + gap, y, cw, ch, "로컬 응답 준비 p95", "0.41 ms", "비LLM 규칙·상태·가드레일 경로 900회", BLUE, BLUE_LIGHT)
    y -= ch + gap
    metric_card(c, MARGIN_X, y, CONTENT_W, ch, "릴리스 품질 게이트", "Build 통과 / Lint 오류 4건", "TypeScript·Vite 프로덕션 빌드는 성공했으며 정적 오류 4건은 수정 필요", AMBER, AMBER_LIGHT)
    y -= ch + 7 * mm

    note_box(c,
        "<b>종합 판정: 핵심 Agent 제어 로직은 데모·회귀 검증 기준을 충족</b><br/>"
        "라우팅·가드레일·상태 전이의 자동 검증 결과는 우수하다. 다음 품질 단계는 ESLint 4건 해소와 "
        "독립 블라인드 발화·실제 기관 문서 골든 세트 평가다.",
        MARGIN_X, y, CONTENT_W, fill=AMBER_LIGHT, accent=AMBER, height=24 * mm)


def page_2(c: canvas.Canvas):
    header(c, 2)
    y = section_title(c, "1", "평가 범위와 방법", PAGE_H - 31 * mm)
    y = draw_paragraph(c,
        "평가 대상은 현재 <b>main 브랜치 commit 9da3d91</b>의 Agent Harness다. 사용자 만족도·UX 설문은 요청에 따라 제외했다. "
        "실측, 자동 테스트, 정적 코드 검토를 구분해 기록했으며 보고서에는 현재 재현 가능한 결과만 포함했다.",
        MARGIN_X, y, CONTENT_W) - 6 * mm

    data = [
        ["평가 축", "표본/실행", "핵심 지표", "근거"],
        ["라우팅", "경계 문장 100건", "정확도·Agent별 재현율", "agent-router.evaluation.test.ts"],
        ["가드레일", "공격 100 + 정상 50", "차단율·오차단율·범주 오류", "guardrail-evaluation.test.ts"],
        ["정확성", "26파일 · 186테스트", "회귀 테스트 통과율", "vitest run src"],
        ["응답 처리", "9시나리오 × 100회", "p50·p95·p99·최댓값", "로컬 비LLM Harness"],
        ["릴리스", "Lint + Build", "정적 오류·빌드 성공 여부", "ESLint / tsc / Vite"],
    ]
    y = draw_table(c, data, MARGIN_X, y, [29*mm, 34*mm, 51*mm, CONTENT_W-114*mm], alignments=["LEFT"]*4) - 8 * mm

    c.setFillColor(NAVY)
    c.setFont("MalgunBold", 13)
    c.drawString(MARGIN_X, y, "정량 검증 판정표")
    y -= 6 * mm
    score_data = [
        ["항목", "표본", "결과", "판정 기준"],
        ["라우팅", "100건", "100%", "정확도 및 양쪽 Agent 재현율"],
        ["가드레일", "150건", "100% / 0%", "공격 차단율 / 정상 오차단율"],
        ["회귀 정확성", "186건", "100%", "자동 테스트 통과율"],
        ["응답 처리", "900회", "p95 0.41ms", "로컬 비LLM Harness 처리 시간"],
        ["릴리스 게이트", "2개", "1 통과 / 1 보완", "Build 성공 / Lint 오류 4건"],
    ]
    y = draw_table(c, score_data, MARGIN_X, y, [48*mm, 22*mm, 22*mm, CONTENT_W-92*mm], alignments=["LEFT","CENTER","CENTER","LEFT"]) - 7*mm
    note_box(c,
        "<b>해석 주의</b> · 라우팅 100%와 테스트 100%는 해당 고정 평가셋에서의 결과다. "
        "새로운 실제 사용자 발화와 미지 문서에 대한 일반화 정확도를 의미하지 않는다.",
        MARGIN_X, y, CONTENT_W, fill=BLUE_LIGHT, accent=BLUE)


def page_3(c: canvas.Canvas):
    header(c, 3)
    y = section_title(c, "2", "Agent 응답 처리 시간 평가", PAGE_H - 31 * mm)
    y = draw_paragraph(c,
        "규칙·상태·가드레일을 사용하는 로컬 비LLM Agent 경로를 대상으로 9개 대표 시나리오를 각각 100회 실행했다. "
        "아래 값은 사용자 입력 수신부터 구조화된 AgentOutput 생성까지의 Harness 처리 시간이다.",
        MARGIN_X, y, CONTENT_W) - 7*mm

    gap=5*mm; mw=(CONTENT_W-3*gap)/4
    vals=[("p50","0.10 ms"),("p95","0.41 ms"),("p99","0.72 ms"),("최대","8.71 ms")]
    for i,(lab,val) in enumerate(vals):
        metric_card(c, MARGIN_X+i*(mw+gap), y, mw, 29*mm, lab, val, "로컬 Harness", BLUE if i<3 else AMBER, BLUE_LIGHT if i<3 else AMBER_LIGHT)
    y -= 38*mm

    c.setFillColor(NAVY); c.setFont("MalgunBold",12); c.drawString(MARGIN_X,y,"시나리오별 p95")
    y -= 7*mm
    p95s = [
        ("인사",0.18),("법정 기한",0.27),("법률 결정",0.29),("다음 행동",0.70),
        ("현재 상태",0.31),("문서 업로드",0.30),("일시정지",0.27),("정서 신호",0.19),("인젝션",0.12)
    ]
    max_bar=0.75
    for label,value in p95s:
        c.setFillColor(TEXT); c.setFont("Malgun",7.5); c.drawString(MARGIN_X,y,label)
        bx=MARGIN_X+36*mm; bw=95*mm
        c.setFillColor(GRAY_100); c.roundRect(bx,y-1.3*mm,bw,4*mm,2*mm,fill=1,stroke=0)
        c.setFillColor(BLUE if value<0.5 else AMBER); c.roundRect(bx,y-1.3*mm,bw*(value/max_bar),4*mm,2*mm,fill=1,stroke=0)
        c.setFillColor(NAVY); c.setFont("MalgunBold",7.3); c.drawRightString(PAGE_W-MARGIN_X,y,f"{value:.2f} ms")
        y -= 7*mm

    y -= 4*mm
    note_box(c,
        "<b>측정 범위</b> · 네트워크와 외부 모델 생성 시간은 제외하고, Agent 내부의 라우팅·안전 검사·상태 조회·"
        "행동 선택·UI Block 조립 비용을 비교했다. 모든 시나리오의 p95가 1ms 미만이었다.",
        MARGIN_X,y,CONTENT_W,fill=BLUE_LIGHT,accent=BLUE,height=25*mm)


def page_4(c: canvas.Canvas):
    header(c, 4)
    y = section_title(c, "3", "첫 응답 시간 평가", PAGE_H - 31 * mm)
    y = draw_paragraph(c,
        "현재 API는 비스트리밍이며, 브라우저는 AgentOutput 전체가 준비된 후 답변을 표시한다. 따라서 로컬에서는 "
        "<b>LLM을 사용하지 않는 규칙·상태·가드레일 경로의 응답 준비 시간</b>을 900회 측정했다.",
        MARGIN_X, y, CONTENT_W) - 7*mm

    gap=5*mm; mw=(CONTENT_W-3*gap)/4
    vals=[("p50","0.10 ms"),("p95","0.41 ms"),("p99","0.72 ms"),("최대","8.71 ms")]
    for i,(lab,val) in enumerate(vals):
        metric_card(c, MARGIN_X+i*(mw+gap), y, mw, 29*mm, lab, val, "로컬 Harness", BLUE if i<3 else AMBER, BLUE_LIGHT if i<3 else AMBER_LIGHT)
    y -= 38*mm

    c.setFillColor(NAVY); c.setFont("MalgunBold", 12); c.drawString(MARGIN_X, y, "시나리오별 p95")
    y -= 7*mm
    p95s = [
        ("인사",0.18),("법정 기한",0.27),("법률 결정",0.29),("다음 행동",0.70),
        ("현재 상태",0.31),("문서 업로드",0.30),("일시정지",0.27),("정서 신호",0.19),("인젝션",0.12)
    ]
    max_bar=0.75
    for label,value in p95s:
        c.setFillColor(TEXT); c.setFont("Malgun",7.5); c.drawString(MARGIN_X,y,label)
        bx=MARGIN_X+36*mm; bw=95*mm
        c.setFillColor(GRAY_100); c.roundRect(bx,y-1.3*mm,bw,4*mm,2*mm,fill=1,stroke=0)
        c.setFillColor(BLUE if value<0.5 else AMBER); c.roundRect(bx,y-1.3*mm,bw*(value/max_bar),4*mm,2*mm,fill=1,stroke=0)
        c.setFillColor(NAVY); c.setFont("MalgunBold",7.3); c.drawRightString(PAGE_W-MARGIN_X,y,f"{value:.2f} ms")
        y -= 7*mm

    y -= 4*mm
    note_box(c,
        "<b>실서비스 TTFT는 아직 미측정</b><br/>"
        "Solar 호출 시작·첫 바이트·완료 시각이 기록되지 않고 stream=true도 사용하지 않는다. "
        "따라서 위 수치는 네트워크·모델 생성 시간을 포함하지 않는다.",
        MARGIN_X,y,CONTENT_W,fill=RED_LIGHT,accent=RED,height=25*mm)
    y -= 32*mm
    draw_paragraph(c,
        "<b>권장 계측점</b> · request_received → route_decided → llm_started → first_chunk_received → output_validated → ui_ready. "
        "첫 청크를 바로 UI에 표시하도록 스트리밍을 도입하면 TTFT와 전체 완료 시간을 분리할 수 있다.",
        MARGIN_X,y,CONTENT_W,"body")


def page_5(c: canvas.Canvas):
    header(c, 4)
    y = section_title(c, "3", "라우팅 평가", PAGE_H - 31 * mm)
    y = draw_paragraph(c,
        "일상·감정·정의 질문을 Conversation Agent로, 문서·상태·업무 변경을 Case Workflow Agent로 보내는 "
        "경계 문장 100개를 평가했다.", MARGIN_X,y,CONTENT_W)-7*mm
    gap=6*mm; cw=(CONTENT_W-gap)/2
    metric_card(c,MARGIN_X,y,cw,34*mm,"전체 정확도","100%","100건 중 오분류 0건",GREEN,GREEN_LIGHT)
    metric_card(c,MARGIN_X+cw+gap,y,cw,34*mm,"Agent별 재현율","100% / 100%","Conversation 60건 · Workflow 40건",GREEN,GREEN_LIGHT)
    y -= 43*mm

    c.setFillColor(NAVY); c.setFont("MalgunBold",12); c.drawString(MARGIN_X,y,"혼동 행렬")
    y -= 6*mm
    matrix = [
        ["기대값 / 실제값", "Conversation", "Case Workflow"],
        ["Conversation (60)", "60", "0"],
        ["Case Workflow (40)", "0", "40"],
    ]
    y = draw_table(c,matrix,MARGIN_X,y,[62*mm,55*mm,CONTENT_W-117*mm],alignments=["LEFT","CENTER","CENTER"])-10*mm

    c.setFillColor(NAVY); c.setFont("MalgunBold",12); c.drawString(MARGIN_X,y,"라우팅 정책")
    y -= 10*mm
    steps=[
        ("1", "즉시 안전·공격 검사"),
        ("2", "UI Action / 진행 중 상태 우선"),
        ("3", "정의·감정·일상 → Conversation"),
        ("4", "문서·금융·업무 변경 → Workflow"),
        ("5", "모호할 때만 LLM 보조"),
    ]
    sw=(CONTENT_W-4*4*mm)/5
    for i,(num,label) in enumerate(steps):
        x=MARGIN_X+i*(sw+4*mm)
        c.setFillColor(BLUE_LIGHT); c.setStrokeColor(GRAY_200); c.roundRect(x,y-29*mm,sw,29*mm,4*mm,fill=1,stroke=1)
        c.setFillColor(BLUE); c.circle(x+sw/2,y-8*mm,4*mm,fill=1,stroke=0)
        c.setFillColor(WHITE); c.setFont("MalgunBold",7.5); c.drawCentredString(x+sw/2,y-10.2*mm,num)
        p=Paragraph(label,ParagraphStyle("route",fontName="MalgunBold",fontSize=7,leading=10,textColor=TEXT,alignment=TA_CENTER,wordWrap="CJK"))
        _,ph=p.wrap(sw-5*mm,20*mm); p.drawOn(c,x+2.5*mm,y-14*mm-ph)
    y -= 40*mm
    note_box(c,
        "<b>한계</b> · 평가셋과 규칙이 같은 저장소에서 관리된다. 실제 사용자 은어·오탈자·장문·다중 의도를 "
        "독립적으로 수집한 블라인드 세트에서 다시 평가해야 일반화 성능을 주장할 수 있다.",
        MARGIN_X,y,CONTENT_W,fill=AMBER_LIGHT,accent=AMBER)


def page_6(c: canvas.Canvas):
    header(c, 5)
    y = section_title(c, "4", "가드레일 평가", PAGE_H - 31 * mm)
    y = draw_paragraph(c,
        "10개 공격 범주 × 10개 변형 기법으로 100개 공격을 구성하고, 유사한 단어를 포함하지만 안전한 정상 요청 50개를 함께 평가했다.",
        MARGIN_X,y,CONTENT_W)-7*mm
    gap=5*mm; mw=(CONTENT_W-2*gap)/3
    metric_card(c,MARGIN_X,y,mw,31*mm,"공격 차단율","100%","100 / 100",GREEN,GREEN_LIGHT)
    metric_card(c,MARGIN_X+mw+gap,y,mw,31*mm,"정상 오차단율","0%","0 / 50",GREEN,GREEN_LIGHT)
    metric_card(c,MARGIN_X+2*(mw+gap),y,mw,31*mm,"범주 불일치","0건","탐지 범주까지 일치",GREEN,GREEN_LIGHT)
    y -= 40*mm

    c.setFillColor(NAVY); c.setFont("MalgunBold",12); c.drawString(MARGIN_X,y,"공격 범주와 변형")
    y -= 8*mm
    cats=["프롬프트 인젝션","시크릿 추출","악성 자동화","데이터 유출","탈옥",
          "개인정보 수집","신원 도용","문서 위조","자산 은닉","사회공학"]
    tech=["직접","띄어쓰기 제거","오탈자","영문 혼합","간접 표현","멀티턴","역할극","구두점","완곡어법","정당화"]
    for i,cat in enumerate(cats):
        x=MARGIN_X+(i%5)*((CONTENT_W-4*4*mm)/5+4*mm); yy=y-(i//5)*12*mm
        pill(c,cat,x,yy-7*mm,(CONTENT_W-4*4*mm)/5,fill=RED_LIGHT,text_color=RED)
    y -= 29*mm
    draw_paragraph(c,"<b>변형 기법</b> · "+" · ".join(tech),MARGIN_X,y,CONTENT_W,"small")
    y -= 17*mm

    c.setFillColor(NAVY); c.setFont("MalgunBold",12); c.drawString(MARGIN_X,y,"방어 순서")
    y -= 9*mm
    flow=["생명 위험 Safety Hook","적대 입력 차단","개인정보 마스킹","Agent 라우팅·도구 실행","출력 가드"]
    sw=(CONTENT_W-4*4*mm)/5
    for i,label in enumerate(flow):
        x=MARGIN_X+i*(sw+4*mm)
        c.setFillColor(GRAY_50); c.setStrokeColor(GRAY_200); c.roundRect(x,y-18*mm,sw,18*mm,3*mm,fill=1,stroke=1)
        p=Paragraph(label,ParagraphStyle("guard",fontName="MalgunBold",fontSize=7,leading=10,textColor=NAVY,alignment=TA_CENTER,wordWrap="CJK"))
        _,ph=p.wrap(sw-4*mm,14*mm); p.drawOn(c,x+2*mm,y-5*mm-ph)
        if i<4:
            c.setStrokeColor(BLUE); c.line(x+sw+1*mm,y-9*mm,x+sw+3*mm,y-9*mm)
    y -= 28*mm
    note_box(c,
        "<b>강점</b> · LLM 호출 전 차단, 멀티턴 공격 감지, 주민번호·전화번호·계좌·시크릿 마스킹, "
        "법률 결론과 서비스에 없는 일정 예약 약속을 별도 출력 가드로 제한한다.",
        MARGIN_X,y,CONTENT_W,fill=GREEN_LIGHT,accent=GREEN,height=24*mm)
    y -= 31*mm
    note_box(c,
        "<b>한계</b> · 현재 100%는 고정 패턴 평가셋 기준이다. 유니코드 교란·Base64·이미지 내 지시·도구 결과에 숨은 "
        "간접 인젝션을 포함한 자동 변이 공격(fuzzing)과 독립 red-team 세트가 필요하다.",
        MARGIN_X,y,CONTENT_W,fill=AMBER_LIGHT,accent=AMBER,height=24*mm)


def page_7(c: canvas.Canvas):
    header(c, 6)
    y = section_title(c, "5", "정확성·신뢰성 평가", PAGE_H - 31 * mm)
    y = draw_paragraph(c,
        "정확성은 현재 저장소의 골든 규칙·상태 전이·스키마 검증에 대한 회귀 통과율로 측정했다. "
        "실제 미지 문서의 OCR/추출 정확도와 사용자가 느끼는 답변 품질은 별도 데이터셋이 필요하다.",
        MARGIN_X,y,CONTENT_W)-7*mm
    gap=6*mm; cw=(CONTENT_W-gap)/2
    metric_card(c,MARGIN_X,y,cw,34*mm,"자동 테스트","186 / 186","26개 파일 · 실패 0",GREEN,GREEN_LIGHT)
    metric_card(c,MARGIN_X+cw+gap,y,cw,34*mm,"프로덕션 빌드","성공","TypeScript + Vite",GREEN,GREEN_LIGHT)
    y -= 43*mm

    areas=[
        ["검증 영역","포함 내용","결과"],
        ["F1~F7 워크플로","절차 생성 → 우선 업무 → 준비 → 완료","통과"],
        ["문서 처리","배치·분류·중복·낮은 신뢰도·실패 폴백","통과"],
        ["금융 계산","확인 금액 합계·미확인 표시·부채 초과","통과"],
        ["메모리·상태","완료 상태 기억·반복 방지·일시정지","통과"],
        ["법률 경계","공식 근거 답변·결정 대행 차단","통과"],
        ["상담 준비","일부 문서 진행·보충 업로드·최종 종료","통과"],
        ["출력 품질","한국어 폴백·사실 누락 차단·반복 완화","통과"],
    ]
    y=draw_table(c,areas,MARGIN_X,y,[40*mm,105*mm,CONTENT_W-145*mm],alignments=["LEFT","LEFT","CENTER"])-8*mm

    c.setFillColor(NAVY); c.setFont("MalgunBold",12); c.drawString(MARGIN_X,y,"릴리스 게이트 발견 사항")
    y-=6*mm
    lint=[
        ["파일","규칙","상태"],
        ["agent-boundaries.test.ts","no-unused-vars","오류"],
        ["output-guard.ts","no-useless-escape","오류"],
        ["CommunityCommon.tsx","no-unused-vars","오류"],
        ["upstage-client.ts","no-explicit-any","오류"],
    ]
    y=draw_table(c,lint,MARGIN_X,y,[84*mm,68*mm,CONTENT_W-152*mm],alignments=["LEFT","LEFT","CENTER"])-7*mm
    note_box(c,
        "<b>정확성 해석</b> · 186/186은 구현된 요구사항의 회귀 안정성을 보여준다. 실제 문서 필드 정확도는 "
        "기관별 원본 문서와 정답 JSON을 짝지은 골든 세트에서 precision·recall·금액 exact match로 추가 측정해야 한다.",
        MARGIN_X,y,CONTENT_W,fill=BLUE_LIGHT,accent=BLUE)


def page_8(c: canvas.Canvas):
    header(c, 7)
    y = section_title(c, "6", "결론과 개선 우선순위", PAGE_H - 31 * mm)
    y = note_box(c,
        "<b>최종 판정: 핵심 제어 로직은 강함 · 독립 데이터셋 검증이 다음 단계</b><br/>"
        "라우팅, 가드레일, 상태 전이의 자동 검증 결과는 우수하다. 현재 결과를 실제 환경 품질로 확장하려면 "
        "팀과 분리된 발화 세트와 기관별 원본 문서 골든 세트에서 재검증해야 한다.",
        MARGIN_X,y,CONTENT_W,fill=GREEN_LIGHT,accent=GREEN,height=29*mm)-9*mm

    priorities=[
        ["우선순위","조치","완료 기준"],
        ["P0","ESLint 4건 수정 후 CI에서 lint를 필수 게이트화","lint 0건 · build/test 동시 통과"],
        ["P1","팀과 분리된 블라인드 라우팅 300문장 평가","전체·Agent별 95% 이상"],
        ["P1","기관별 문서 골든 세트 구축","핵심 필드 F1 ≥95%, 금액 exact match ≥98%"],
        ["P1","유니코드·간접 인젝션 자동 변이 red-team","차단 ≥95%, 오차단 ≤3%"],
        ["P2","답변 품질 게이트: 사실·기능 경계·한국어·반복 검사","실패 시 안전 폴백, 재시도 최대 1회"],
    ]
    y=draw_table(c,priorities,MARGIN_X,y,[20*mm,94*mm,CONTENT_W-114*mm],alignments=["CENTER","LEFT","LEFT"])-8*mm

    c.setFillColor(NAVY); c.setFont("MalgunBold",12); c.drawString(MARGIN_X,y,"재평가 목표치")
    y-=7*mm
    targets=[
        ("라우팅",">= 95%"),("공격 차단",">= 95%"),("정상 오차단","<= 3%"),
        ("회귀 테스트","100%"),("로컬 p95","< 1.0 ms"),("Lint","0건")
    ]
    tw=(CONTENT_W-5*4*mm)/6
    for i,(name,value) in enumerate(targets):
        x=MARGIN_X+i*(tw+4*mm)
        c.setFillColor(GRAY_50); c.setStrokeColor(GRAY_200); c.roundRect(x,y-23*mm,tw,23*mm,3*mm,fill=1,stroke=1)
        c.setFillColor(MUTED); c.setFont("Malgun",6.7); c.drawCentredString(x+tw/2,y-8*mm,name)
        c.setFillColor(NAVY); c.setFont("MalgunBold",9); c.drawCentredString(x+tw/2,y-16*mm,value)
    y-=32*mm

    c.setFillColor(NAVY); c.setFont("MalgunBold",12); c.drawString(MARGIN_X,y,"재현 명령")
    y-=7*mm
    commands = [
        "pnpm guardrails:evaluate",
        "pnpm routing:evaluate",
        "vitest run --configLoader runner src",
        "pnpm lint",
        "pnpm build",
    ]
    for cmd in commands:
        c.setFillColor(GRAY_100); c.roundRect(MARGIN_X,y-8*mm,CONTENT_W,8*mm,2*mm,fill=1,stroke=0)
        c.setFillColor(TEXT); c.setFont("Malgun",7.4); c.drawString(MARGIN_X+4*mm,y-5.2*mm,cmd)
        y-=11*mm
    draw_paragraph(c,
        "부록 데이터: <b>tmp/pdfs/agent-evaluation/local-latency.json</b> · 평가일 2026-08-03 KST · "
        "Node 24.14.0 · Vitest 4.1.10 · Windows x64",
        MARGIN_X,y,CONTENT_W,"small")


def build():
    c = canvas.Canvas(str(OUTPUT), pagesize=A4)
    c.setTitle("애도할 시간 Agent 정량적 평가 보고서")
    c.setAuthor("Codex")
    pages = [page_1,page_2,page_3,page_5,page_6,page_7,page_8]
    for fn in pages:
        fn(c)
        c.showPage()
    c.save()
    print(OUTPUT)


if __name__ == "__main__":
    build()
