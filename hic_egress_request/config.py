from traitlets import Unicode, default
from traitlets.config import Configurable
import os
from dotenv import load_dotenv
from pathlib import Path

result = load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")
print(Path(__file__).parent.parent / ".env")
print(f"dotenv loaded: {result}")  # False = file not found or empty


class EgressRequestConfig(Configurable):
    hic_egress_creation_service_url = Unicode(config=True)

    @default("hic_egress_creation_service_url")
    def _default_hic_egress_service_url(self):
        return os.environ.get(
            "HIC_EGRESS_CREATION_SERVICE_URL", "http://127.0.0.1:8080"
        )
