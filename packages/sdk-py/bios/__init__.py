"""Official Python SDK for BiOS, the protein-design API.

    from bios import BiOS
    bios = BiOS(api_key="bios_sk_live_...")
    design = bios.design("an enzyme that breaks down PET at room temperature")
    for event in bios.stream("knock out human PCSK9"):
        ...  # event: route | stages | token | saved | result | done

Standard-library only; no third-party dependencies.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any, Dict, Iterator, Optional

__all__ = ["BiOS", "BiOSError"]


class BiOSError(Exception):
    def __init__(self, message: str, status: Optional[int] = None, request_id: Optional[str] = None):
        super().__init__(message)
        self.status = status
        self.request_id = request_id


class BiOS:
    def __init__(self, api_key: Optional[str] = None, base_url: str = "http://localhost:3001"):
        self.api_key = api_key or os.environ.get("BIOS_API_KEY")
        self.base_url = base_url.rstrip("/")

    # ---- internals ----
    def _headers(self) -> Dict[str, str]:
        h = {"Content-Type": "application/json"}
        if self.api_key:
            h["Authorization"] = "Bearer " + self.api_key
        return h

    def _url(self, path: str) -> str:
        return self.base_url + "/v1" + path

    def _request(self, method: str, path: str, body: Optional[dict]) -> urllib.request.Request:
        data = json.dumps(body).encode() if body is not None else None
        return urllib.request.Request(self._url(path), data=data, headers=self._headers(), method=method)

    def _send(self, method: str, path: str, body: Optional[dict] = None) -> Any:
        try:
            with urllib.request.urlopen(self._request(method, path, body)) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            raise BiOSError(self._error_message(e), e.code, e.headers.get("BiOS-Request-Id"))

    @staticmethod
    def _error_message(e: urllib.error.HTTPError) -> str:
        try:
            b = json.load(e)
            err = b.get("error")
            if isinstance(err, dict):
                return err.get("message") or "Request failed"
            return err or ("HTTP " + str(e.code))
        except Exception:
            return "HTTP " + str(e.code)

    # ---- API ----
    def design(self, intent: str, parent_id: Optional[str] = None) -> Dict[str, Any]:
        """Design a biological artifact and return the full result."""
        body: Dict[str, Any] = {"intent": intent}
        if parent_id:
            body["parentId"] = parent_id
        return self._send("POST", "/designs", body)

    def get_design(self, design_id: str) -> Dict[str, Any]:
        """Fetch a design by its permalink id (with its permalink id merged in)."""
        d = self._send("GET", "/designs/" + design_id)
        if isinstance(d, dict) and "result" in d:
            result = dict(d["result"])
            result["id"] = d.get("id")
            return result
        return d

    def fold(self, sequence: str) -> Dict[str, Any]:
        """Fold a sequence (ESMFold): returns pdb + mean pLDDT confidence."""
        return self._send("POST", "/fold", {"sequence": sequence})

    def search(self, query: str) -> Dict[str, Any]:
        """Search natural proteins (GenBank)."""
        return self._send("POST", "/search", {"query": query})

    def stream(self, intent: str, parent_id: Optional[str] = None) -> Iterator[Dict[str, Any]]:
        """Stream the design pipeline as SSE events (a generator of dicts)."""
        body: Dict[str, Any] = {"intent": intent}
        if parent_id:
            body["parentId"] = parent_id
        req = self._request("POST", "/designs/stream", body)
        try:
            with urllib.request.urlopen(req) as r:
                for raw in r:
                    line = raw.decode("utf-8", "replace").strip()
                    if line.startswith("data:"):
                        try:
                            yield json.loads(line[5:].strip())
                        except json.JSONDecodeError:
                            continue
        except urllib.error.HTTPError as e:
            raise BiOSError(self._error_message(e), e.code)
