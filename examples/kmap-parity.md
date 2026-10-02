# 卡诺图化简

变量顺序：ABCD（左侧为高位）

F = Σm(1, 2, 4, 7, 8, 11, 13, 14)

| AB \ CD | 00 | 01 | 11 | 10 |
|---|---:|---:|---:|---:|
| 00 | 0 | 1① | 0 | 1② |
| 01 | 1③ | 0 | 1④ | 0 |
| 11 | 0 | 1⑦ | 0 | 1⑧ |
| 10 | 1⑤ | 0 | 1⑥ | 0 |

## 分组

①：(m1) → A'·B'·C'·D
②：(m2) → A'·B'·C·D'
③：(m4) → A'·B·C'·D'
④：(m7) → A'·B·C·D
⑤：(m8) → A·B'·C'·D'
⑥：(m11) → A·B'·C·D
⑦：(m13) → A·B·C'·D
⑧：(m14) → A·B·C·D'

## 最简与或式

F = A'·B'·C'·D + A'·B'·C·D' + A'·B·C'·D' + A'·B·C·D + A·B'·C'·D' + A·B'·C·D + A·B·C'·D + A·B·C·D'

$$F = \overline{A}\overline{B}\overline{C}D+\overline{A}\overline{B}C\overline{D}+\overline{A}B\overline{C}\overline{D}+\overline{A}BCD+A\overline{B}\overline{C}\overline{D}+A\overline{B}CD+AB\overline{C}D+ABC\overline{D}$$

真值验证：通过（无关项不参与一致性要求）。
优化顺序：先最少乘积项，再最少文字数；等价最简式可能不唯一。
编号标记表示分组，重复标记表示该格参与多个组。