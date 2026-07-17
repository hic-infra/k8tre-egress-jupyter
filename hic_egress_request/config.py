from traitlets import Unicode, default
from traitlets.config import Configurable
import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(dotenv_path=Path(__file__).parent / ".env")

class EgressRequestConfig(Configurable):
    aws_endpoint_url = Unicode(config=True)

    @default("aws_endpoint_url")
    def _default_aws_endpoint_url(self):
        return os.environ.get("aws_endpoint_url", "")

    aws_access_key_id = Unicode(config=True)

    @default("aws_access_key_id")
    def _default_aws_access_key_id(self):
        return os.environ.get("aws_access_key_id", "")
    
    aws_secret_access_key = Unicode(config=True)

    @default("aws_secret_access_key")
    def _default_aws_secret_access_key(self):
        return os.environ.get("aws_secret_access_key", "")
    
    aws_region_name = Unicode(config=True)

    @default("aws_region_name")
    def _default_region_name(self):
        return os.environ.get("aws_region_name", "")
    
    s3_bucket_name = Unicode(config=True)

    @default("s3_bucket_name")
    def _default_s3_bucket_name(self):
        return os.environ.get("s3_bucket_name", "")

    jwt_secret_key = Unicode(config=True)

    @default("jwt_secret_key")
    def _default_jwt_secret_key(self):
        return os.environ.get("jwt_secret_key", "")