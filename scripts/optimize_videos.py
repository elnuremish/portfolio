"""Re-encode retained video sources for faster delivery; requires ffmpeg."""
import argparse,json,subprocess,pathlib
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument("--ffmpeg",default="ffmpeg")
args=parser.parse_args()
root=pathlib.Path(__file__).resolve().parents[1]
ffmpeg=args.ffmpeg
p=root/'content/portfolio.json';content=json.loads(p.read_text())
for key,project in content.items():
 if key=='home':continue
 for item in project['items']:
  if item['type'] not in ('embed','video'):continue
  source=item.setdefault('sourceSrc',item['src'])
  for field,height,crf,rate in [('src',1080,24,2200)]:
   out=root/'assets'/f'{pathlib.Path(source).stem.rsplit("-",1)[0]}-fast-{height}.mp4'
   if not out.exists():
    subprocess.run([ffmpeg,'-y','-v','error','-i',str(root/source),'-vf',f'scale=-2:min({height}\\,ih)','-r','30','-c:v','libx264','-preset','slow','-crf',str(crf),'-maxrate',f'{rate}k','-bufsize',f'{rate*2}k','-g','30','-pix_fmt','yuv420p','-c:a','aac','-b:a','80k','-movflags','+faststart',str(out)],check=True)
   old=(root/item[field]).stat().st_size
   if out.stat().st_size < old:
    item[field]=out.relative_to(root).as_posix()
   elif out != root/item[field]:
    out.unlink()
    continue
   print(out.name,old,'->',out.stat().st_size,flush=True)
p.write_text(json.dumps(content,ensure_ascii=False,indent=2)+'\n')
