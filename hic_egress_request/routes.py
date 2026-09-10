import json

from hic_egress_request.config import EgressRequestConfig
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado
from tornado.web import HTTPError
import os
import httpx

from hic_egress_request.logging import get_logger, setup_logging

setup_logging()
logger = get_logger(__name__)


class EgressRequestHandler(APIHandler):
    config = EgressRequestConfig()

    @tornado.web.authenticated
    def post(self):
        try:
            data = self.get_json_body()

            if data is None:
                raise HTTPError(400, reason="Request body must be valid JSON")

            paths = data.get("paths", [])
            if not paths:
                raise HTTPError(400, reason="No paths provided")

            paths = list(map(self._resolve_local_path, paths))

            user_token = os.environ.get("JUPYTERHUB_API_TOKEN")
            with httpx.Client() as client:
                resp = client.post(
                    f"{self.config.hic_egress_creation_service_url}/create-egress",
                    headers={"Authorization": f"token {user_token}"},
                )

            data = resp.json()
            session_id = data["token"]
            self.log.info(f"Created egress id {session_id}")

            uploaded = []
            for path in paths:
                with httpx.Client() as client:
                    with open(path, "rb") as f:
                        files = {"file": f}
                        resp = client.post(
                            f"{self.config.hic_egress_creation_service_url}/upload-file",
                            headers={"Authorization": f"token {user_token}"},
                            data={"session_id": session_id},
                            files=files,
                        )
                        self.log.info(f"Uploading file {path}")
                        uploaded.append(f)

            with httpx.Client() as client:
                resp = client.post(
                    f"{self.config.hic_egress_creation_service_url}/request-egress",
                    headers={"Authorization": f"token {user_token}"},
                    data={"session_id": session_id},
                )
            self.log.info(f"Finished egress id {session_id}")

            self.set_status(resp.status_code)
            self.finish(resp.text)
        except FileNotFoundError as e:
            self.log.error(f"Could not find file {e} to upload")
            raise HTTPError(400, reason="File not found")
        except httpx.RequestError as e:
            self.log.error(f"Failed to connect to egress creation service {e}")
            raise HTTPError(500, reason="Could not connect to egress creation service")

    @tornado.web.authenticated
    def get(self):
        # the user's own Hub API token, set by JupyterHub in this pod's env
        user_token = os.environ.get("JUPYTERHUB_API_TOKEN")
        SERVICE_URL_BASE = os.environ.get(
            "HIC_EGRESS_SERVICE_URL", "http://127.0.0.1:8080"
        )
        SERVICE_URL = f"{SERVICE_URL_BASE}/hello"
        with httpx.Client() as client:
            resp = client.get(
                SERVICE_URL,
                headers={"Authorization": f"token {user_token}"},
            )

        self.set_status(resp.status_code)
        self.finish(resp.text)

    def write_error(self, status_code, **kwargs):
        self.set_header("Content-Type", "application/json")
        self.finish(json.dumps({"error": self._reason}))

    def _resolve_local_path(self, relative_path: str) -> str:
        root_dir = self.contents_manager.root_dir
        return f"{root_dir}/{relative_path}"


def setup_route_handlers(web_app):
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]

    send_files_route_pattern = url_path_join(
        base_url, "hic-egress-request", "send-files"
    )

    handlers = [(send_files_route_pattern, EgressRequestHandler)]

    web_app.add_handlers(host_pattern, handlers)
