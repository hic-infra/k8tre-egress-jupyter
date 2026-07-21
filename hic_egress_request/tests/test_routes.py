import json
from unittest.mock import MagicMock, patch
import pytest
from tornado.httpclient import HTTPClientError


@pytest.fixture
def mock_config():
    with patch("hic_egress_request.routes.EgressRequestConfig") as MockConfig:
        instance = MockConfig.return_value
        instance.s3_bucket_name = "test-bucket"
        instance.jwt_secret_key = "test-secret"
        yield instance


async def test_post_success(jp_fetch, mock_config):
    with patch("hic_egress_request.routes.get_seaweed_client") as mock_get_client:
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        response = await jp_fetch(
            "hic-egress-request",
            "send-files",
            method="POST",
            body=json.dumps({"paths": ["file1.txt", "file2.txt"]}),
        )

        assert response.code == 200
        payload = json.loads(response.body)
        assert payload["status"] == "ok"
        assert payload["uploaded"] == ["file1.txt", "file2.txt"]
        assert "token" in payload

        assert mock_client.upload_file.call_count == 2


async def test_post_no_body(jp_fetch, mock_config):
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


async def test_post_invalid_body(jp_fetch, mock_config):
    with pytest.raises(HTTPClientError) as exc_info:
        await jp_fetch(
            "hic-egress-request",
            "send-files",
            method="POST",
            body="not json",
        )
    assert exc_info.value.response.code == 400


async def test_post_no_paths(jp_fetch, mock_config):

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


async def test_post_upload_failure(jp_fetch, mock_config):
    with patch("hic_egress_request.routes.get_seaweed_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.upload_file.side_effect = Exception("connection refused")
        mock_get_client.return_value = mock_client

        with pytest.raises(HTTPClientError) as exc_info:
            await jp_fetch(
                "hic-egress-request",
                "send-files",
                method="POST",
                body=json.dumps({"paths": ["file1.txt"]}),
            )

        assert exc_info.value.response.code == 500
        payload = json.loads(exc_info.value.response.body)
        assert payload["error"] == "Cannot connect to S3"
