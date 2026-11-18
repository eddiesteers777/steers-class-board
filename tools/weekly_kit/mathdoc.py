import re, copy
from fractions import Fraction
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn, nsdecls
from docx.oxml import parse_xml, OxmlElement
from lxml import etree

M="http://schemas.openxmlformats.org/officeDocument/2006/math"
W="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
BLUE=RGBColor(0x2F,0x54,0x96)
MINUS="−"

# ---------- math markup -> OMML ----------
def _mr(text, bold=False):
    r=etree.SubElement(etree.Element("dummy"), f"{{{M}}}r")
    if bold:
        rpr=etree.SubElement(r, f"{{{W}}}rPr"); etree.SubElement(rpr, f"{{{W}}}b")
    t=etree.SubElement(r, f"{{{M}}}t"); t.text=text
    t.set("{http://www.w3.org/XML/1998/namespace}space","preserve")
    return r
def _match(s,i,o,c):
    d=0
    for j in range(i,len(s)):
        if s[j]==o: d+=1
        elif s[j]==c:
            d-=1
            if d==0: return j
    raise ValueError("unbalanced: "+s)
def _split_top(s,sep="|"):
    d=0
    for j,ch in enumerate(s):
        if ch=="{": d+=1
        elif ch=="}": d-=1
        elif ch==sep and d==0: return s[:j],s[j+1:]
    raise ValueError("no sep: "+s)
def parse_math(s, bold=False):
    out=[]; buf=""; i=0
    def flush():
        nonlocal buf
        if buf: out.append(_mr(buf,bold)); buf=""
    while i<len(s):
        ch=s[i]
        if ch=="{":
            j=_match(s,i,"{","}")
            inner=s[i+1:j]; a,b=_split_top(inner)
            flush()
            f=etree.Element(f"{{{M}}}f")
            n=etree.SubElement(f,f"{{{M}}}num"); [n.append(e) for e in parse_math(a,bold)]
            d=etree.SubElement(f,f"{{{M}}}den"); [d.append(e) for e in parse_math(b,bold)]
            out.append(f); i=j+1
        elif ch=="[":
            j=_match(s,i,"[","]")
            base=s[i+1:j]
            if s[j+1:j+3]=="^{":
                k=_match(s,j+2,"{","}"); exp=s[j+3:k]
                flush()
                sp=etree.Element(f"{{{M}}}sSup")
                e=etree.SubElement(sp,f"{{{M}}}e"); [e.append(x) for x in parse_math(base,bold)]
                su=etree.SubElement(sp,f"{{{M}}}sup"); [su.append(x) for x in parse_math(exp,bold)]
                out.append(sp); i=k+1
            else:
                buf+=s[i:j+1]; i=j+1
        else:
            buf+=ch; i+=1
    flush(); return out

def add_runs(p, markup, size=None, bold_all=False, italic_all=False, color=None):
    """markup: **bold**, __italic__, $math$ . returns paragraph"""
    parts=re.split(r"(\*\*)",markup)
    bold=bold_all
    for part in parts:
        if part=="**": bold = (not bold) if not bold_all else bold; continue
        segs=re.split(r"(\$[^$]*\$)",part)
        for seg in segs:
            if not seg: continue
            if seg.startswith("$") and seg.endswith("$") and len(seg)>=2:
                om=etree.Element(f"{{{M}}}oMath")
                for e in parse_math(seg[1:-1],bold): om.append(e)
                p._p.append(om)
            else:
                # italic via __x__
                its=re.split(r"(~~)",seg); it=italic_all
                for q in its:
                    if q=="~~": it=not it; continue
                    if not q: continue
                    for piece in re.split(r"(@@FIG\d+@@)", q):   # pictures (figures.py) sit on their own line
                        if not piece: continue
                        fm=re.fullmatch(r"@@FIG(\d+)@@", piece)
                        if fm:
                            import figures
                            path, w = figures.png(int(fm.group(1)))
                            r=p.add_run(); r.add_break(); r.add_picture(path, width=Inches(w)); r.add_break(); continue
                        r=p.add_run(piece.replace('§','$')); r.bold=bold; r.italic=it
                        if size: r.font.size=Pt(size)
                        if color: r.font.color.rgb=color
    return p

def fmt(fr, mixed=False):
    """Fraction/int/Decimal-like -> markup (no $)"""
    fr=Fraction(fr)
    sign=MINUS if fr<0 else ""
    a=abs(fr)
    if a.denominator==1: return f"{sign}{a.numerator}"
    if mixed and a>1:
        w=a.numerator//a.denominator; r=a-w
        return f"{sign}{w}{{{r.numerator}|{r.denominator}}}"
    return f"{sign}{{{a.numerator}|{a.denominator}}}"
def dec(fr):
    fr=Fraction(fr); s=format(float(fr),'.6f').rstrip('0').rstrip('.')
    return s.replace("-",MINUS)

# ---------- document ----------
class Doc:
    def __init__(self, margins=0.7, base=11):
        self.d=Document(); self.base=base
        sec=self.d.sections[0]
        sec.page_width=Inches(8.5); sec.page_height=Inches(11)
        for a in ("left_margin","right_margin","top_margin","bottom_margin"): setattr(sec,a,Inches(margins))
        st=self.d.styles["Normal"]; st.font.name="Calibri"; st.font.size=Pt(base)
        st.element.rPr.rFonts.set(qn("w:eastAsia"),"Calibri")
        st.paragraph_format.space_after=Pt(3); st.paragraph_format.space_before=Pt(0)
        self.w=8.5-2*margins
    def p(self, markup="", size=None, bold=False, italic=False, align=None, after=None, before=None, color=None, keep=False):
        p=self.d.add_paragraph()
        add_runs(p,markup,size,bold,italic,color)
        if align=="center": p.alignment=WD_ALIGN_PARAGRAPH.CENTER
        if after is not None: p.paragraph_format.space_after=Pt(after)
        if before is not None: p.paragraph_format.space_before=Pt(before)
        if keep: p.paragraph_format.keep_with_next=True
        return p
    def title(self,t,sub=None,size=20):
        p=self.p(t,size=size,bold=True,color=BLUE,after=1)
        if sub: self.p(sub,size=10.5,italic=True,color=RGBColor(0x55,0x55,0x55),after=4)
    def h2(self,t,size=14,before=8):
        return self.p(t,size=size,bold=True,color=BLUE,before=before,after=3,keep=True)
    def space(self,n=1,size=None):
        for _ in range(n): self.p("",size=size or 11,after=0)
    def newpage(self,para):
        """Start para on a new page. Drops an empty spacer just before it, so a table that
        ends at the foot of a page cannot push the spacer over and leave a blank page."""
        prev=para._p.getprevious()
        if prev is not None and prev.tag==qn("w:p") and not "".join(prev.itertext()).strip(): prev.getparent().remove(prev)
        para.paragraph_format.page_break_before=True; return para
    def pagebreak(self):
        self.d.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
    def _shade(self,cell,hexfill):
        tcPr=cell._tc.get_or_add_tcPr()
        shd=parse_xml(f'<w:shd {nsdecls("w")} w:val="clear" w:color="auto" w:fill="{hexfill}"/>'); tcPr.append(shd)
    def _borders(self,table,color="8EA9DB",sz=8,outer_color=None):
        tbl=table._tbl; tblPr=tbl.tblPr
        b=parse_xml(f'<w:tblBorders {nsdecls("w")}>'+"".join(f'<w:{s} w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>' for s in ("top","left","bottom","right","insideH","insideV"))+'</w:tblBorders>')
        tblPr.append(b)
    def _cellmargins(self,table,top=40,bottom=40,left=80,right=80):
        tblPr=table._tbl.tblPr
        m=parse_xml(f'<w:tblCellMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tblCellMar>')
        tblPr.append(m)
    def _fill_cell(self,cell,content,size=None,bold=False,align=None):
        paras=content if isinstance(content,list) else [content]
        first=True
        for c in paras:
            p=cell.paragraphs[0] if first else cell.add_paragraph()
            first=False
            add_runs(p,c,size,bold)
            p.paragraph_format.space_after=Pt(2)
            if align=="center": p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    def box(self,paras,fill="EEF3FA",border="2F5496",size=None):
        t=self.d.add_table(rows=1,cols=1); t.alignment=WD_TABLE_ALIGNMENT.CENTER
        self._borders(t,color=border,sz=12); self._cellmargins(t,80,80,120,120)
        c=t.rows[0].cells[0]; self._shade(c,fill); self._fill_cell(c,paras,size)
        self.p("",size=4,after=0); return t
    def table(self,rows,widths=None,header=True,size=None,hdrfill="D9E3F2",align_cols=None,rowheight=None,border="8EA9DB",cant_split=True,keep=False):
        n=len(rows[0]); t=self.d.add_table(rows=len(rows),cols=n); t.alignment=WD_TABLE_ALIGNMENT.CENTER
        t.autofit=False; self._borders(t,color=border); self._cellmargins(t)
        for i,r in enumerate(rows):
            for j,c in enumerate(r):
                cell=t.rows[i].cells[j]
                self._fill_cell(cell,c,size,bold=(header and i==0))
                if header and i==0: self._shade(cell,hdrfill)
                if widths: cell.width=Inches(widths[j])
            if cant_split:
                trPr=t.rows[i]._tr.get_or_add_trPr(); trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))
            if rowheight and not (header and i==0):
                trPr=t.rows[i]._tr.get_or_add_trPr(); trPr.append(parse_xml(f'<w:trHeight {nsdecls("w")} w:val="{int(rowheight*1440)}" w:hRule="atLeast"/>'))
        if widths:
            for j,wd in enumerate(widths): t.columns[j].width=Inches(wd)
        if keep:   # keep the whole table on one page: every row but the last stays with the next
            for r in t.rows[:-1]:
                for cell in r.cells:
                    for q in cell.paragraphs: q.paragraph_format.keep_with_next=True
        self.p("",size=4,after=0); return t
    def steps(self,lines,size=None,split=0.42):
        """Two-column worked steps (math | why). Never breaks across a page."""
        rows=[[f"**{a}**",b] for a,b in lines]
        return self.table(rows,widths=[self.w*split,self.w*(1-split)],header=False,size=size,keep=True)
    def namerow(self,period=True):
        self.p("**Name:** ______________________________   **Date:** ______________   **Class/Period:** ________",after=4)
    def save(self,path): self.d.save(path)
