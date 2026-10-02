"""Build a seven-page Chinese learning workbook from verified local results."""
from pathlib import Path
import json
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
import xml.etree.ElementTree as ET
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
DATA = json.loads((ROOT / 'docs/workbook-data.json').read_text(encoding='utf-8'))
OUT = ROOT / 'output/pdf/数字逻辑与AI基础速练册.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('Youyan', 'C:/Windows/Fonts/msyh.ttc'))
pdfmetrics.registerFont(TTFont('YouyanBold', 'C:/Windows/Fonts/msyhbd.ttc'))
pdfmetrics.registerFont(TTFont('Segoe UI', 'C:/Windows/Fonts/msyh.ttc'))
pdfmetrics.registerFont(TTFont('Microsoft YaHei', 'C:/Windows/Fonts/msyh.ttc'))
W, H = A4
NAVY, BLUE, GRAY, LINE = map(HexColor, ['#172b49', '#245cd8', '#64748b', '#dce5f1'])
c = canvas.Canvas(str(OUT), pagesize=A4, pageCompression=1)
c.setTitle('邮研 - 数字逻辑与AI基础速练册')
c.setAuthor('邮研学习工作台')
page = 0

def p(text, y, size=11, color=NAVY, x=44, width=None, bold=False):
    style = ParagraphStyle('body', fontName='YouyanBold' if bold else 'Youyan', fontSize=size, leading=size*1.8, textColor=color, wordWrap='CJK')
    paragraph = Paragraph(escape(text).replace('\n', '<br/>'), style)
    _, height = paragraph.wrap(width or W-88, H)
    paragraph.drawOn(c, x, y-height)
    return y-height-9

def begin(title, subtitle, eyebrow):
    global page
    page += 1
    c.setFillColor(BLUE); c.rect(44, H-58, 24, 3, fill=1, stroke=0)
    p(eyebrow, H-66, 9, BLUE, bold=True)
    p(title, H-95, 21, bold=True)
    return p(subtitle, H-133, 10, GRAY)-12

def end():
    c.setStrokeColor(LINE);c.line(44, 43, W-44, 43)
    c.setFont('Youyan', 8);c.setFillColor(GRAY)
    c.drawString(44, 28, '邮研 · 自编练习 · 先作答，再核对')
    c.drawRightString(W-44, 28, f'{page} / 7')
    c.showPage()

def blank_map(n, y):
    rows = 4 if n == 4 else 2
    row_labels = ['00', '01', '11', '10'] if n == 4 else ['0', '1']
    cw, ch, left = 102, 64, 93
    c.setFont('Youyan', 10);c.setFillColor(GRAY)
    c.drawString(44, y-20, 'AB / CD' if n == 4 else 'A / BC')
    for i, col in enumerate(['00', '01', '11', '10']):c.drawCentredString(left+i*cw+cw/2, y-20, col)
    top=y-33
    for ri, row in enumerate(row_labels):
        c.drawRightString(77, top-ri*ch-ch/2-4, row)
        for ci in range(4):
            c.setStrokeColor(LINE);c.rect(left+ci*cw,top-(ri+1)*ch,cw,ch,stroke=1,fill=0)
    return top-rows*ch-26

def lines(y, count=3):
    c.setStrokeColor(LINE)
    for _ in range(count):c.line(44,y,W-44,y);y-=32
    return y-8

def draw_svg(file, y):
    """Render our own rect/text-only SVG with the PDF library, no extra dependency."""
    svg = ET.parse(file).getroot()
    width, height = float(svg.attrib['width']), float(svg.attrib['height'])
    def color(value):
        return HexColor('#'+''.join(ch*2 for ch in value[1:]) if len(value)==4 and value.startswith('#') else value)
    scale = min((W-100)/width, 400/height)
    c.saveState();c.translate((W-width*scale)/2, y-height*scale);c.scale(scale, scale)
    for el in svg.iter():
        tag=el.tag.rsplit('}',1)[-1];a=el.attrib
        if tag=='rect':
            x=float(a.get('x',0));top=float(a.get('y',0))
            w=width if a.get('width')=='100%' else float(a['width'])
            h=height if a.get('height')=='100%' else float(a['height'])
            fill=a.get('fill','none');stroke=a.get('stroke','none')
            if fill!='none':c.setFillColor(color(fill))
            if stroke!='none':c.setStrokeColor(color(stroke))
            c.setLineWidth(float(a.get('stroke-width',1)))
            c.setDash([float(v) for v in a.get('stroke-dasharray','').split()])
            c.roundRect(x,height-top-h,w,h,float(a.get('rx',0)),fill=int(fill!='none'),stroke=int(stroke!='none'))
            c.setDash()
        elif tag=='text':
            c.setFillColor(color(a.get('fill','#172b49')))
            c.setFont('YouyanBold' if a.get('font-weight')=='700' else 'Youyan',float(a['font-size']))
            x,baseline=float(a['x']),height-float(a['y']);text=''.join(el.itertext())
            if a.get('text-anchor')=='middle':c.drawCentredString(x,baseline,text)
            elif a.get('text-anchor')=='end':c.drawRightString(x,baseline,text)
            else:c.drawString(x,baseline,text)
    c.restoreState()
    return height*scale

for problem in DATA['problems']:
    y=begin(problem['title'], '用工作台核验前，先独立完成下面的图与化简。', 'DIGITAL LOGIC / WORKSHEET')
    given=f"F = Σm({', '.join(map(str,problem['ones']))})"
    if problem['dc']:given+=f"；d = Σd({', '.join(map(str,problem['dc']))})"
    y=p(given,y,13,bold=True);y=p(problem['prompt'],y)
    y=blank_map(problem['n'],y-10)
    for question in ['我的分组（写出各组最小项）：','哪些变量在组内变化，哪些保持不变？','最简与或式与真值核验：']:
        y=p(question,y,10,GRAY);y=lines(y,1)
    if problem['n']==3:
        y=p('额外回忆：无关项必须全部覆盖吗？一个组能不能包含0？',y,11,bold=True)
        y=lines(y,2)
    assert y > 50, f'worksheet overflow: {problem["id"]}'
    end()

for problem in DATA['problems']:
    y=begin(problem['title'].replace('练习','核对'), '同色框属于同一个组；虚线分段表示跨边界相邻。', 'DIGITAL LOGIC / EXPLANATION')
    y-=draw_svg(ROOT / f'examples/kmap-{problem["id"]}.svg',y)+17
    y=p(problem['reason'],y,11)
    y=p('核对重点：所有实际1都被覆盖，没有0落入组内；不要只核对最终公式。',y,10,GRAY)
    if problem['id']=='dontcares':
        a=DATA['ai']; f=a['first']
        y=p('线性回归：第一步参考',y,12,bold=True)
        y=p(f"默认数据、w=b=0、η=0.1：dw={a['initial']['dw']:.5f}，db={a['initial']['db']:.5f}。同步更新后 w={f['w']:.5f}，b={f['b']:.5f}，训练L从{a['initial']['loss']:.5f}降到{f['after']['loss']:.5f}。",y,10)
    assert y>50, f'answer overflow: {problem["id"]}'
    end()

y=begin('把一次实验写成自己的理解', '打开AI小实验，先写预测，再点一步；把没讲清的概念存成复习卡。', 'AI FOUNDATIONS / EXPERIMENT')
y=p('模型 ŷ=wx+b；L=Σ(ŷ-y)²/(2m)；MSE=2L。两个梯度从同一组旧参数计算。',y,12,bold=True)
for title, question in [
    ('1. 学习率','η从0.1改为0.8。你预计损失怎样变化？实际1步、20步后分别是多少？'),
    ('2. 特征尺度','x放大50倍、y不变。最优斜率为什么约缩小为原来的1/50？稳定学习率为什么改变？'),
    ('3. 离群点与测试集','加入离群点后，最小二乘参考怎样改变？训练误差最小是否保证测试误差最小？')
]:
    y=p(title,y,12,BLUE,bold=True);y=p(question,y,10);y=lines(y,2)
y=p('下次复习，我要不看答案解释的一个概念：',y,11,bold=True);y=lines(y,1)
y=p('基础参考（公式与概念核对；演示题与数据由本项目自编）：',y,9,GRAY)
y=p('MIT Computation Structures：数字逻辑结构讲义。\nStanford CS229：线性回归与批量梯度下降讲义。',y,9,GRAY)
c.linkURL('https://ocw.mit.edu/courses/6-004-computation-structures-spring-2017/pages/c4/c4s1/',(44,y+25,W-44,y+43),relative=0)
c.linkURL('https://cs229.stanford.edu/summer2023/cs229-notes1.pdf',(44,y+5,W-44,y+23),relative=0)
assert y>50, 'experiment page overflow'
end();c.save()
reader=PdfReader(str(OUT))
assert len(reader.pages)==7
for i, pdf_page in enumerate(reader.pages):
    text=pdf_page.extract_text()
    assert len(text)>150, f'empty or unreadable page {i+1}'
assert '线性回归' in reader.pages[5].extract_text()
print(f'Saved 7 verified text pages: {OUT}')
