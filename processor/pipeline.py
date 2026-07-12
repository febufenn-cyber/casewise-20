from __future__ import annotations
import hashlib, hmac, json, os, re, subprocess, tempfile, urllib.parse, urllib.request
from pathlib import Path

class PipelineError(RuntimeError):
    def __init__(self, code, message, security=False): super().__init__(message); self.code=code; self.security=security

def run(command, timeout=180, check=True):
    p=subprocess.run(command,text=True,capture_output=True,timeout=timeout,check=False)
    if check and p.returncode!=0: raise PipelineError("command_failed",f"{command[0]} failed: {p.stderr[:500]}")
    return p

def download(url,destination,max_bytes):
    total=0
    with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"casewise-processor/1"}),timeout=120) as response, destination.open("wb") as out:
        while chunk:=response.read(1024*1024):
            total+=len(chunk)
            if total>max_bytes: raise PipelineError("file_too_large","Downloaded file exceeded limit")
            out.write(chunk)

def upload(base,token,relative,source,media):
    safe="/".join(urllib.parse.quote(part,safe="-._~") for part in relative.split("/")); target=f"{base.rstrip('/')}/{safe}?token={urllib.parse.quote(token,safe='')}"
    data=source.read_bytes(); request=urllib.request.Request(target,method="PUT",data=data,headers={"Content-Type":media,"Content-Length":str(len(data))})
    with urllib.request.urlopen(request,timeout=120) as response:
        if response.status not in (200,201): raise PipelineError("artifact_upload_failed",str(response.status))

def callback(url,payload,secret):
    body=json.dumps(payload,separators=(",",":")).encode(); signature=hmac.new(secret.encode(),body,hashlib.sha256).hexdigest()
    with urllib.request.urlopen(urllib.request.Request(url,method="POST",data=body,headers={"Content-Type":"application/json","X-Casewise-Signature":signature}),timeout=120) as response:
        if response.status not in (200,201,202): raise PipelineError("callback_failed",str(response.status))

def inspect_pdf(path,max_pages):
    if path.read_bytes()[:5]!=b"%PDF-": raise PipelineError("invalid_pdf_signature","Input is not a PDF")
    check=run(["qpdf","--check",str(path)],check=False); combined=(check.stdout+check.stderr).lower(); warnings=[]
    if check.returncode not in (0,3): raise PipelineError("malformed_pdf",check.stderr[:500])
    if check.returncode==3: warnings.append("qpdf_recoverable_warnings")
    if "encrypted" in combined or "password" in combined: raise PipelineError("password_protected","Password-protected PDFs are unsupported")
    raw=path.read_bytes(); markers=[m.decode(errors="ignore") for m in (b"/JavaScript",b"/Launch",b"/EmbeddedFile",b"/OpenAction") if m in raw]
    if markers: warnings.append("active_or_embedded_content:"+",".join(markers))
    info=run(["pdfinfo",str(path)]); match=re.search(r"^Pages:\s+(\d+)$",info.stdout,re.MULTILINE)
    if not match: raise PipelineError("page_count_unavailable","Unable to determine page count")
    pages=int(match.group(1));
    if pages<1 or pages>max_pages: raise PipelineError("page_limit_exceeded",f"PDF page count {pages} is unsupported")
    return pages,warnings

def process_job(job):
    for field in ("job_id","input_url","artifact_base_url","artifact_token","callback_url","pipeline_version"):
        if not job.get(field): raise PipelineError("invalid_job",f"Missing {field}")
    with tempfile.TemporaryDirectory(prefix="casewise-") as temp:
        work=Path(temp); source=work/"original.pdf"; download(job["input_url"],source,int(os.environ.get("MAX_INPUT_BYTES",104857600)))
        digest=hashlib.sha256(source.read_bytes()).hexdigest(); page_count,file_warnings=inspect_pdf(source,int(os.environ.get("MAX_PAGES",2000))); pages=[]; unreadable=0
        for number in range(1,page_count+1):
            index=number-1; image=work/f"page-{index:04d}.png"; native=work/f"page-{index:04d}-native.txt"; selected=work/f"page-{index:04d}.txt"
            run(["mutool","draw","-q","-r","144","-F","png","-o",str(image),str(source),str(number)])
            run(["pdftotext","-f",str(number),"-l",str(number),"-layout",str(source),str(native)])
            text=native.read_text(errors="replace") if native.exists() else ""; method="native_text"; warnings=[]
            if len(re.sub(r"\s+","",text))<int(os.environ.get("OCR_CHARACTER_THRESHOLD",40)):
                ocr=run(["tesseract",str(image),"stdout","--dpi","144","-l","eng"],timeout=240,check=False)
                if ocr.returncode==0 and len(re.sub(r"\s+","",ocr.stdout))>len(re.sub(r"\s+","",text)): text=ocr.stdout; method="ocr"; warnings.append("native_text_sparse_ocr_selected")
                elif not text.strip(): warnings.append("page_text_unreadable"); unreadable+=1
            selected.write_text(text,encoding="utf-8"); render_path=f"pages/{image.name}"; text_path=f"text/{selected.name}"
            upload(job["artifact_base_url"],job["artifact_token"],render_path,image,"image/png"); upload(job["artifact_base_url"],job["artifact_token"],text_path,selected,"text/plain; charset=utf-8")
            pages.append({"pdf_page_index":index,"render_path":render_path,"text_path":text_path,"extraction_method":method,"text_length":len(text),"warnings":warnings})
        return {"status":"partial_success" if unreadable or file_warnings else "succeeded","sha256":digest,"page_count":page_count,"pages":pages,"file_warnings":file_warnings}

def safe_failure(error):
    if isinstance(error,PipelineError): return {"status":"security_quarantine" if error.security else "permanent_failure","error_code":error.code,"file_warnings":[str(error)[:500]]}
    return {"status":"permanent_failure","error_code":"processor_unhandled_error","file_warnings":[type(error).__name__]}
