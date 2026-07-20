import json

from hic_egress_request.config import EgressRequestConfig
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado
import boto3
from botocore.client import Config
import jwt
import uuid


def get_seaweed_client():
    config = EgressRequestConfig()
    return boto3.client(
        "s3",
        endpoint_url=config.aws_endpoint_url,  # SeaweedFS S3 gateway address
        aws_access_key_id=config.aws_access_key_id,
        aws_secret_access_key=config.aws_secret_access_key,
        config=Config(signature_version="s3v4"),
        region_name=config.aws_region_name,
    )


class EgressRequestHandler(APIHandler):
    @tornado.web.authenticated
    def post(self):
        config = EgressRequestConfig()
        print(config.trait_values())
        data = self.get_json_body()
        if data is None:
            self.set_status(400)
            self.finish(json.dumps({"error": "Request body must be valid JSON"}))
            return

        paths = data.get("paths", [])
        if not paths:
            self.set_status(400)
            self.finish(json.dumps({"error": "No paths provided"}))
            return

        client = get_seaweed_client()
        bucket = config.s3_bucket_name
        uploaded = []

        for path in paths:
            # `path` here is the workspace-relative path from the file browser drop;
            # resolve it against your actual notebook root/contents dir
            local_path = self._resolve_local_path(path)
            key = path.lstrip("/")

            try:
                client.upload_file(local_path, bucket, key)
                uploaded.append(key)
            except Exception as e:
                self.log.error(f"Failed to upload {path} to SeaweedFS: {e}")

        # Create the jwt
        project_id = uuid.uuid4()
        token = jwt.encode(
            {"projectId": "5", "userId": "", "bucketId": config.s3_bucket_name},
            config.jwt_secret_key,
            algorithm="HS256",
        )

        self.finish(json.dumps({"status": "ok", "uploaded": uploaded, "token": token}))

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
