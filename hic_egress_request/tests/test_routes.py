import json
from unittest.mock import Mock, patch
from hic_egress_request.config import EgressRequestConfig
import pytest
from tornado.httpclient import HTTPClientError
import respx
import httpx

config = EgressRequestConfig()


@pytest.fixture
def mock_egress_service(monkeypatch):
    """Mock the egress service endpoints."""
    # Set required environment variables
    monkeypatch.setenv("JUPYTERHUB_API_TOKEN", "test-token-12345")

    with respx.mock:
        respx.post(f"{config.hic_egress_creation_service_url}/create-egress").mock(
            return_value=httpx.Response(200, json={"token": "session-token-xyz"})
        )

        respx.post(f"{config.hic_egress_creation_service_url}/upload-file").mock(
            return_value=httpx.Response(200, json={"status": "uploaded"})
        )

        respx.post(f"{config.hic_egress_creation_service_url}/request-egress").mock(
            return_value=httpx.Response(
                200,
                text=json.dumps(
                    {"status": "ok", "uploaded": [], "token": "session-token-xyz"}
                ),
            )
        )

        yield respx


@pytest.fixture
def sample_files(tmp_path):
    """Create sample files in a temporary directory."""
    file1 = tmp_path / "file1.txt"
    file1.write_text("This is file 1 content")

    file2 = tmp_path / "file2.txt"
    file2.write_text("This is file 2 content")

    # Return relative filenames AND the tmp_path
    return ["file1.txt", "file2.txt"], tmp_path


@pytest.fixture
def mock_contents_manager(sample_files):
    """Mock the contents manager to use tmp_path as root."""
    filenames, tmp_path = sample_files

    mock_cm = Mock()
    mock_cm.root_dir = str(tmp_path)

    return mock_cm


async def test_post_success(
    jp_fetch, mock_egress_service, sample_files, mock_contents_manager, monkeypatch
):
    """Test successful file upload."""
    filenames, tmp_path = sample_files

    # Patch the handler's contents_manager
    monkeypatch.setattr(
        "hic_egress_request.routes.EgressRequestHandler.contents_manager",
        mock_contents_manager,
        raising=False,
    )
    response = await jp_fetch(
        "hic-egress-request",
        "send-files",
        method="POST",
        body=json.dumps({"paths": filenames}),
    )

    assert response.code == 200
    payload = json.loads(response.body)
    print(payload)


async def test_invalid_files(jp_fetch, mock_egress_service):

    sample_files = ["file_that_doesnt_exist.txt"]
    with pytest.raises(HTTPClientError) as exc_info:
        response = await jp_fetch(
            "hic-egress-request",
            "send-files",
            method="POST",
            body=json.dumps({"paths": sample_files}),
        )

        assert response.code == 400


async def test_post_no_body(jp_fetch, mock_egress_service):
    with pytest.raises(HTTPClientError) as exc_info:
        await jp_fetch(
            "hic-egress-request",
            "send-files",
            method="POST",
            body="",
        )
    assert exc_info.value.response.code == 400
    payload = json.loads(exc_info.value.response.body)
    assert payload["error"] == "Request body must be valid JSON"


async def test_post_invalid_body(jp_fetch, mock_egress_service):
    with pytest.raises(HTTPClientError) as exc_info:
        await jp_fetch(
            "hic-egress-request",
            "send-files",
            method="POST",
            body="not json",
        )
    assert exc_info.value.response.code == 400


async def test_post_no_paths(jp_fetch, mock_egress_service):

    with pytest.raises(HTTPClientError) as exc_info:
        await jp_fetch(
            "hic-egress-request",
            "send-files",
            method="POST",
            body=json.dumps({"paths": []}),
        )
    assert exc_info.value.response.code == 400
    payload = json.loads(exc_info.value.response.body)
    assert payload["error"] == "No paths provided"
