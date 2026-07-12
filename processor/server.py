from __future__ import annotations
import hashlib, hmac, json, os, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pipeline import callback, process_job, safe_failure
SECRET = os.environ.get("PROCESSOR_SHARED_SECRET", "")

def valid_signature(body: bytes, provided: str | None) -> bool:
    return bool(len(SECRET) >= 32 and provided and hmac.compare_digest(hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest(), provided))

def run_job(job):
    try: result = process_job(job)
    except Exception as error: result = safe_failure(error)
    try: callback(job["callback_url"], result, SECRET)
    except Exception as error: print(json.dumps({"event":"processor_callback_failed","job_id":job.get("job_id"),"error":type(error).__name__}), flush=True)

class Handler(BaseHTTPRequestHandler):
    def send_json(self, status, payload):
        body=json.dumps(payload).encode(); self.send_response(status); self.send_header("Content-Type","application/json"); self.send_header("Content-Length",str(len(body))); self.send_header("Cache-Control","no-store"); self.end_headers(); self.wfile.write(body)
    def do_GET(self): self.send_json(200,{"status":"ok"}) if self.path=="/healthz" else self.send_json(404,{"error":"not_found"})
    def do_POST(self):
        if self.path!="/process": return self.send_json(404,{"error":"not_found"})
        try: length=int(self.headers.get("Content-Length","0"))
        except ValueError: return self.send_json(400,{"error":"invalid_content_length"})
        if length<1 or length>1048576: return self.send_json(413,{"error":"request_too_large"})
        body=self.rfile.read(length)
        if not valid_signature(body,self.headers.get("X-Casewise-Signature")): return self.send_json(401,{"error":"invalid_signature"})
        try: job=json.loads(body)
        except json.JSONDecodeError: return self.send_json(400,{"error":"invalid_json"})
        threading.Thread(target=run_job,args=(job,),daemon=True).start(); self.send_json(202,{"status":"accepted","job_id":job.get("job_id")})

if __name__=="__main__":
    if len(SECRET)<32: raise SystemExit("PROCESSOR_SHARED_SECRET must contain at least 32 characters")
    ThreadingHTTPServer(("0.0.0.0",int(os.environ.get("PORT","8788"))),Handler).serve_forever()
