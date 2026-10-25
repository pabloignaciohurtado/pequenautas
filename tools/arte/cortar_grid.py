import sys, io, base64, json, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
# uso: cortar_grid.py SRC ROWS COLS ids(coma) PREFIJO_VAR OUTDIR LADO MAXBYTES [pares]
SRC,ROWS,COLS,IDS,PRE,OUT,LADO,MAXB=sys.argv[1],int(sys.argv[2]),int(sys.argv[3]),sys.argv[4].split(','),sys.argv[5],sys.argv[6],int(sys.argv[7]),int(sys.argv[8])
PARES=len(sys.argv)>9
im=Image.open(SRC).convert('RGB'); W,H=im.size
a=np.asarray(im).astype(int); R,G,B=a[...,0],a[...,1],a[...,2]
import os
key=((R>G+100)&(B>G+40)) if os.environ.get("ESTRICTO") else ((R>G+40)&(B>G+8)&(R>90))
cuts=[]
obj=ndimage.binary_opening(~key,structure=np.ones((3,3)))
obj=ndimage.binary_fill_holes(obj)
grp=ndimage.binary_dilation(obj,structure=np.ones((25,25)))
lab,n=ndimage.label(grp); sizes=ndimage.sum(obj,lab,range(1,n+1))
top=sorted(range(1,n+1),key=lambda i:-sizes[i-1])[:ROWS*COLS]
info=[]
for i in top:
  ys,xs=np.where(lab==i); info.append((i,ys.mean(),xs.mean()))
info.sort(key=lambda t:(int(t[1]/(H/ROWS)),t[2]))
for i,cy,cx in info:
  m=obj&(lab==i)&~((R>G+100)&(B>G+60))
  alpha=Image.fromarray((m*255).astype('uint8')).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
  cell=im.copy(); cell.putalpha(alpha); cell=cell.crop(alpha.getbbox())
  cuts.append(cell)
if PARES:  # (madre, bebé) consecutivos: el bebé conserva su tamaño relativo
  for i in range(0,len(cuts),2):
    mo,ba=cuts[i],cuts[i+1]
    cw,ch=max(mo.width,ba.width),max(mo.height,ba.height)
    def pad(x):
      c=Image.new('RGBA',(cw,ch),(0,0,0,0)); c.paste(x,((cw-x.width)//2,ch-x.height),x); return c
    cuts[i],cuts[i+1]=pad(mo),pad(ba)
for k,cell in zip(IDS,cuts):
  w,h=cell.size; s=LADO/max(w,h); cell=cell.resize((max(1,round(w*s)),max(1,round(h*s))),Image.LANCZOS)
  lo,hi,best=20,90,None
  while lo<=hi:
    q=(lo+hi)//2; b=io.BytesIO(); cell.save(b,'WEBP',quality=q,method=6)
    if b.tell()<=MAXB: best=(q,b.getvalue()); lo=q+1
    else: hi=q-1
  q,d=best; b64=base64.b64encode(d).decode(); L=[b64[i:i+76] for i in range(0,len(b64),76)]
  open(f'{OUT}/{k}.css','w').write(':root{--%s-%s:url("data:image/webp;base64,%s\\\n");}\n'%(PRE,k,"\\\n".join(L)))
  cell.save(f'prev-{k}.png'); print(k,cell.size,'q',q,len(d))
