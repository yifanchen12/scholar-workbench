"""Seven printable AI practice pages; own examples and native vector charts."""
from pathlib import Path
import json
import math
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import Color, HexColor
from reportlab.lib.pagesizes import A4
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from pypdf import PdfReader
from math_lab import forward, loss_gradient

ROOT = Path(__file__).resolve().parent
REPORT = json.loads((ROOT/'output/实验报告.json').read_text(encoding='utf-8'))
OUT = ROOT/'output/从梯度到分类-实训讲义.pdf'
pdfmetrics.registerFont(TTFont('LabText', 'C:/Windows/Fonts/msyh.ttc'))
pdfmetrics.registerFont(TTFont('LabBold', 'C:/Windows/Fonts/msyhbd.ttc'))
W, H = A4
INK, BLUE, GRAY, LINE = map(HexColor, ['#172b49', '#245cd8', '#64748b', '#dce5f1'])
c = canvas.Canvas(str(OUT), pagesize=A4, pageCompression=1)
c.setTitle('邮研 - 从梯度到分类实训讲义')
c.setAuthor('邮研学习工作台')
page = 0


def paragraph(text, y, size=10.5, bold=False, color=INK, gap=7):
    style = ParagraphStyle('p', fontName='LabBold' if bold else 'LabText', fontSize=size,
                           leading=size*1.7, textColor=color, wordWrap='CJK')
    p = Paragraph(escape(text).replace('\n', '<br/>'), style)
    _, height = p.wrap(W-88, H)
    if y-height < 67:
        raise ValueError(f'Page {page} overflows at: {text[:35]}')
    p.drawOn(c, 44, y-height)
    return y-height-gap


def begin(title, subtitle, label):
    global page
    page += 1
    c.setFillColor(BLUE); c.rect(44, H-56, 26, 3, stroke=0, fill=1)
    paragraph(label, H-66, 9, True, BLUE)
    paragraph(title, H-94, 22, True)
    return paragraph(subtitle, H-132, 10, color=GRAY)-12


def end():
    c.setStrokeColor(LINE); c.line(44, 43, W-44, 43)
    c.setFont('LabText', 8); c.setFillColor(GRAY)
    c.drawString(44, 28, '邮研 · 自编AI实训 · 先预测，再运行，再解释')
    c.drawRightString(W-44, 28, f'{page} / 7')
    c.showPage()


def writing_lines(y, count=3, spacing=30):
    c.setStrokeColor(LINE)
    for _ in range(count):
        if y < 75:
            raise ValueError('Writing space touches footer.')
        c.line(44, y, W-44, y); y -= spacing
    return y-8


def decision(model, x, top, side, title):
    c.setFont('LabBold', 11); c.setFillColor(INK); c.drawString(x, top+20, title)
    lo, hi, bins = -1.25, 1.25, 32
    scaler = REPORT['scaler']
    for row in range(bins):
        for col in range(bins):
            raw = [lo+(col+.5)/bins*(hi-lo), hi-(row+.5)/bins*(hi-lo)]
            inp = [(raw[j]-scaler['mean'][j])/scaler['scale'][j] for j in range(2)]
            p, _ = forward(model, inp)
            rgb = [(1-p[1])*a+p[1]*b for a,b in zip((.80,.86,1), (1,.86,.68))]
            c.setFillColor(Color(*rgb)); c.rect(x+col*side/bins, top-(row+1)*side/bins, side/bins+.15, side/bins+.15, stroke=0, fill=1)
    c.setStrokeColor(GRAY); c.setLineWidth(.6); c.rect(x, top-side, side, side, stroke=1, fill=0)
    shown = 0
    for point, label in REPORT['rawSamples']['test']:
        cx, cy = x+(point[0]-lo)/(hi-lo)*side, top-(hi-point[1])/(hi-lo)*side
        if not (x <= cx <= x+side and top-side <= cy <= top):
            continue
        shown += 1
        c.setFillColor(BLUE if label==0 else HexColor('#a5560c')); c.setStrokeColor(HexColor('#ffffff'))
        c.circle(cx, cy, 2.5, stroke=1, fill=1)
    assert shown == REPORT['split']['test'], 'Unexpected clipped test samples.'
    c.setFont('LabText', 8.5); c.setFillColor(GRAY)
    c.drawString(x, top-side-15, '-1.25'); c.drawRightString(x+side, top-side-15, '1.25  x1')
    c.drawRightString(x-5, top-4, '1.25'); c.drawRightString(x-5, top-side+3, '-1.25')
    c.drawString(x-5, top+7, 'x2')


def loss_plot(y):
    x, width, height = 76, W-126, 150
    histories = REPORT['classification']
    maximum = max(max(r['trainLoss'],r['validationLoss']) for item in histories.values() for r in item['history'])*1.08
    for i in range(5):
        level = maximum*i/4; py = y-height+height*i/4
        c.setStrokeColor(LINE); c.line(x, py, x+width, py)
        c.setFont('LabText', 8.5); c.setFillColor(GRAY); c.drawRightString(x-9, py-3, f'{level:.2f}')
    for name, color in [('linear', BLUE), ('relu8', HexColor('#a5560c'))]:
        for key, dash in [('trainLoss', []), ('validationLoss', [3,2])]:
            history = histories[name]['history']; path = c.beginPath()
            for i, row in enumerate(history):
                px, py = x+row['epoch']/REPORT['epochs']*width, y-height+row[key]/maximum*height
                (path.moveTo if i==0 else path.lineTo)(px,py)
            c.setDash(dash);c.setStrokeColor(color);c.setLineWidth(1.4);c.drawPath(path,stroke=1,fill=0)
    c.setDash();c.setStrokeColor(GRAY);c.setLineWidth(.5);c.line(x,y-height,x+width,y-height)
    c.setFont('LabText',8.5);c.setFillColor(GRAY);c.drawString(x,y-height-15,'0');c.drawRightString(x+width,y-height-15,f'{REPORT["epochs"]} 轮')
    return y-height-34


y = begin('先手算，再让程序运行', '配套工作台AI小实验与Python标准库实训。这里使用自编合成数据，题目和图均可复查。', '01 / GRADIENT DESCENT')
y = paragraph('本页任务：y = 2x + 1，模型预测为 w*x + b。约定残差r = w*x+b-y。初始w=b=0，学习率0.1，损失为平方误差和除以2m。先填写残差与梯度，再看第3页答案。', y)
left, widths, row_h = 44, [70,85,115,115,122], 35
columns = ['x','y','残差 r','r*x','r²']
for row in range(6):
    x = left
    for col,width in enumerate(widths):
        c.setStrokeColor(LINE);c.setFillColor(HexColor('#f2f6fd') if row==0 else HexColor('#ffffff'));c.rect(x,y-(row+1)*row_h,width,row_h,fill=1,stroke=1)
        value = columns[col] if row==0 else str(row-3) if col==0 else str(2*(row-3)+1) if col==1 else ''
        c.setFont('LabBold' if row==0 else 'LabText',10);c.setFillColor(INK);c.drawCentredString(x+width/2,y-row*row_h-22,value)
        x += width
y -= 6*row_h+22
for question in ['初始损失L、dw、db分别是多少？', '同一份旧参数下，新w、b分别是多少？损失会下降吗？', '若去掉损失里的1/2，要保持同样更新，学习率应怎样改？']:
    y = paragraph(question,y,bold=True);y=writing_lines(y,2,27)
end()

y = begin('追踪一个样本的前向与反向', '为便于手算，本页用2→2 ReLU→2的小例子；运行实训的分类网络有8个隐藏单元。', '02 / CHAIN RULE')
for text in ['输入x=[1,-2]；真实标签y=1（类别从0开始）。', 'W1=[[1,0.5],[-1,1]]，b1=[0.5,0]。', 'W2=[[2,-1],[-1,1]]，b2=[0,0]。', '矩阵约定：W[输出][输入]。a=W1*x+b1；h=ReLU(a)；z=W2*h+b2；p=Softmax(z)。']:
    y=paragraph(text,y)
for question in ['1. 求a、h、z和两个概率p。哪个隐藏单元不激活？', '2. 交叉熵对分数的梯度为p-onehot(y)。求dz、dW2、db2。', '3. 用旧W2把梯度传回：dh=W2的转置*dz。经过ReLU后求da、dW1、db1。']:
    y=paragraph(question,y,bold=True);y=writing_lines(y,3,27)
y=paragraph('思考：如果先更新W2再求dh，还能把这一组梯度当成旧模型的完整梯度吗？',y,color=GRAY)
end()

y = begin('对照答案，核查每一个因子', '数值由同一实训模块计算；先看残差符号、平均因子和矩阵方向，再看小数。', '03 / CHECK YOUR DERIVATION')
manual={'hidden_w':[[1,.5],[-1,1]],'hidden_b':[.5,0.], 'output_w':[[2.,-1.],[-1.,1.]],'output_b':[0.,0.]}
p, (pre,h,z)=forward(manual,[1.,-2.]);loss,g=loss_gradient(manual,[([1.,-2.],1)])
assert abs(p[0]-.8175744761936437)<1e-12
assert abs(g['hidden_w'][0][1]+6*p[0])<1e-12
for text in ['回归：初始残差[3,1,-1,-3,-5]，平方和45，m=5，所以L=4.5。dw=-4，db=-1；新w=0.4、b=0.1；新损失2.965。去掉1/2后梯度加倍，学习率应减半。',
             f'网络前向：a={pre}，h={h}，z={z}。p≈[{p[0]:.6f},{p[1]:.6f}]，交叉熵≈{loss:.6f}。',
             f'dz≈[{p[0]:.6f},{-p[0]:.6f}]；dW2≈[[{p[0]/2:.6f},0],[{-p[0]/2:.6f},0]]；db2=dz。',
             f'dh≈[{3*p[0]:.6f},{-2*p[0]:.6f}]。第2单元a<0，故da≈[{3*p[0]:.6f},0]。',
             f'dW1≈[[{3*p[0]:.6f},{-6*p[0]:.6f}],[0,0]]；db1≈[{3*p[0]:.6f},0]。',
             '这里只有一个样本，不再额外除以大于1的批量大小。多样本时先求和，再统一除以m。所有梯度都在更新任何参数之前算完。']:
    y=paragraph(text,y,gap=13)
y=paragraph('两个数值保护与一条独立检查',y,13,True)
y=paragraph('Softmax先减最大分数再取指数；交叉熵用log-sum-exp计算，不用随意裁剪概率隐藏大损失。中心有限差分比较独立数值导数，但应避开ReLU的0点折线。',y)
y=paragraph('有限差分：(L(theta+eps)-L(theta-eps))/(2*eps)。它核对的是选定位置附近的导数，不证明标签、数据划分或新场景能力都正确。',y)
y=paragraph('代码位置：math_lab.py中的forward、loss_gradient、gradient_check；验证命令：python practice/test_math_lab.py。',y,color=GRAY)
end()

y = begin('用图看见模型表示能力', '固定种子2025的400个合成簇样本：训练240 / 验证80 / 测试80。均值与标准差只来自训练。', '04 / EXPERIMENT EVIDENCE')
top=y-32
decision(REPORT['classification']['linear']['parameters'],72,top,205,'线性Softmax')
decision(REPORT['classification']['relu8']['parameters'],342,top,205,'8单元ReLU网络')
y=top-240
y=paragraph('蓝点是真实类别0，棕点是真实类别1；背景是类别1的模型概率。两个轴都是原始坐标。测试点在训练结束后展示，未用于选参数。',y,9.5)
y=paragraph('平均交叉熵：蓝色线性模型 / 棕色网络；实线训练 / 虚线验证',y,10,True)
y=loss_plot(y-5)
for name,label in [('linear','线性模型'),('relu8','ReLU网络')]:
    r=REPORT['classification'][name]
    y=paragraph(f'{label}：验证选中第{r["selectedEpoch"]}轮；测试{r["test"]["accuracy"]:.1%}，交叉熵{r["test"]["loss"]:.6f}。',y,9.5,gap=4)
y=paragraph('一条直线无法分开两对对角簇；隐藏层可形成分段边界。简单合成样本上的高分不等于真实应用能力，不能与digits实验的指标混用。',y,9.5,color=GRAY)
end()

questions=[
    '回归初始损失为什么是4.5？新参数与新损失分别是多少？',
    '去掉损失中的1/2时，同样更新幅度对应怎样的学习率？',
    '给所有Softmax分数加10000，为什么数学概率不变而直接exp可能出错？',
    'p=[0.9,0.1]、真实类别1时，两个分数梯度是什么？',
    '为什么分数梯度之和为0？它对应哪种不变性？',
    'ReLU在负、正、0区间的导数怎样理解？',
    '先更新输出权重再计算隐藏梯度，会破坏什么约定？',
    '同一批样本复制两遍，平均损失与平均梯度为何不变？',
    '测试均值与训练均值不同，能否合并全数据拟合标准化器？',
    '第600轮训练损失更低，是否一定应替代验证选中的第598轮？',
    '梯度检查通过，是否证明标签、划分与泛化都正确？',
    '80张简单合成测试样本全对，能否宣称实际应用准确率100%？']
y=begin('合上代码，独立回答12个问题','先用自己的话写结论与依据，再翻到下一页。答案看起来熟悉，不等于能独立解释。','05 / ACTIVE RECALL')
for i,q in enumerate(questions,1):
    y=paragraph(f'{i}. {q}',y,10.5,bold=True,gap=5);y=writing_lines(y,1,19)
end()

answers=[
    '平方和45除以10得4.5；dw=-4、db=-1；新w=0.4、b=0.1，L=2.965。',
    '梯度加倍，学习率减半；学习率数值必须与损失约定一起解释。',
    '分子分母的指数公共因子可约掉。机器exp(10000)会溢出，先减最大分数。',
    '[0.9,-0.9]。下降更新降低错误类分数并提高真实类分数。',
    '概率和与one-hot和都是1；对应全部分数同加常数时概率不变。',
    '负区间为0，正区间为1；0处没有唯一普通导数，实现需约定。',
    '完整梯度应来自同一份旧参数；混用新旧权重不再对应这次旧模型梯度。',
    '分子与样本数同时翻倍，比值不变。若翻倍，检查平均因子。',
    '不应把测试统计用于拟合预处理；仅训练侧拟合，再统一变换。',
    '不一定。训练损失降低不保证验证更好；按预先约定的验证选择，测试不选轮次。',
    '不能。只验证选定输入/参数附近的导数；研究设计与新场景还需独立检查。',
    '不能。只描述这次分布的80个样本；保留样本量、分布与实际任务差异。']
y=begin('核对理由，而不只核对数字','把你遗漏的条件改写成自己的错题卡。12张配套文本可在工作台批量录入。','06 / ANSWER KEY')
for i,a in enumerate(answers,1):
    y=paragraph(f'{i}. {a}',y,10.5,gap=10)
y=paragraph('来源与复现',y,12,True)
y=paragraph('题目、合成数据、代码与图为本项目自编。回归与分类基础可参考Stanford CS229讲义。真实digits数据的UCI作者、许可、随机划分与限制见工作区“数字分类模型说明.md”；本册没有把它当作合成样本。',y,9.5,color=GRAY)
label='Stanford CS229 notes / 2023';c.setFont('LabText',9);c.setFillColor(BLUE);c.drawString(44,y-10,label);c.linkURL('https://cs229.stanford.edu/summer2023/cs229-notes1.pdf',(44,y-13,220,y+2),relative=0)
end()

y=begin('留下一次可复查的实验','先复制原输出，再只改一个条件。建议将这一页与JSON报告放在一起。','07 / YOUR EXPERIMENT')
for label in ['问题与运行前预测：','固定条件：数据、种子、模型、预处理：','这次唯一改变的条件：','梯度检查结果与训练曲线：','验证选择与理由：','最终测试指标、混淆矩阵与误判：','与预测不同的地方：','目前不能得出的结论：','下一次要验证的问题：']:
    y=paragraph(label,y,10.5,True,gap=6);y=writing_lines(y,1,27)
y=paragraph('运行：python practice/run_lab.py。报告、实际样本、参数与曲线存于practice/output；复习文本在examples/AI实训复习卡.txt。普通网页使用无需Python。',y,9.5,color=GRAY)
end()
c.save()
reader=PdfReader(str(OUT))
assert len(reader.pages)==7
texts=[p.extract_text() for p in reader.pages]
assert all(len(t)>100 for t in texts)
assert '2.965' in texts[2] and 'Softmax' in texts[1] and '80' in texts[4]
print(f'Built {OUT.name}: 7 pages, native vector plots, {sum(len(t) for t in texts)} extracted characters.')
