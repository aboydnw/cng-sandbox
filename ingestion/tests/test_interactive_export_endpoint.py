import io
import json
import zipfile


def test_interactive_export_returns_zip_with_manifest(
    client, seeded_story_with_prose_chapter
):
    story_id = seeded_story_with_prose_chapter
    response = client.post(f"/api/stories/{story_id}/export/interactive")

    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("application/zip")
    assert "attachment" in response.headers["content-disposition"]

    archive = zipfile.ZipFile(io.BytesIO(response.content))
    names = set(archive.namelist())

    assert "manifest.json" in names
    assert "index.html" in names

    manifest = json.loads(archive.read("manifest.json"))
    assert manifest["story"]["id"] == story_id
    assert len(manifest["chapters"]) == 1
    assert manifest["chapters"][0]["type"] == "prose"


def test_interactive_export_excludes_copc_layer(client):
    conn_resp = client.post(
        "/api/connections",
        json={
            "name": "Autzen",
            "connection_type": "copc",
            "url": "https://example.com/a.copc.laz",
        },
    )
    assert conn_resp.status_code == 201
    conn_id = conn_resp.json()["id"]

    story_resp = client.post(
        "/api/stories",
        json={
            "title": "Lidar Story",
            "description": "",
            "published": True,
            "chapters": [
                {
                    "id": "ch-map",
                    "order": 0,
                    "type": "map",
                    "title": "Points",
                    "narrative": "",
                    "map_state": {
                        "center": [-123.07, 44.05],
                        "zoom": 12,
                        "bearing": 0,
                        "pitch": 0,
                        "basemap": "streets",
                    },
                    "layer_config": {
                        "dataset_id": "unused",
                        "connection_id": conn_id,
                        "colormap": "viridis",
                        "opacity": 1.0,
                        "basemap": "streets",
                    },
                }
            ],
        },
    )
    assert story_resp.status_code == 201, story_resp.text
    story_id = story_resp.json()["id"]

    response = client.post(f"/api/stories/{story_id}/export/interactive")
    assert response.status_code == 400
    assert "not yet supported" in response.json()["detail"]


def test_interactive_export_rejects_unknown_story(client):
    response = client.post("/api/stories/does-not-exist/export/interactive")
    assert response.status_code == 404


def test_interactive_export_rejects_wrong_workspace(
    app, seeded_story_with_prose_chapter
):
    from starlette.testclient import TestClient

    story_id = seeded_story_with_prose_chapter
    other = TestClient(
        app,
        raise_server_exceptions=False,
        headers={"X-Workspace-Id": "otherWS01"},
    )
    # Story is published; non-owner can still fetch a published story per existing
    # auth model. Mark unpublished to test rejection.
    from src.models.story import StoryRow

    session = app.state.db_session_factory()
    try:
        row = session.get(StoryRow, story_id)
        row.published = False
        session.commit()
    finally:
        session.close()

    response = other.post(f"/api/stories/{story_id}/export/interactive")
    assert response.status_code == 404


def test_interactive_export_with_chart_chapter(
    client, seeded_story_with_chart_chapter, monkeypatch
):
    monkeypatch.setattr(
        "src.services.interactive_export.builder._fetch_csv_rows",
        lambda url: [{"year": 2020, "v": 1.0}, {"year": 2021, "v": 2.0}],
    )
    story_id = seeded_story_with_chart_chapter
    response = client.post(f"/api/stories/{story_id}/export/interactive")
    assert response.status_code == 200, response.text
    archive = zipfile.ZipFile(io.BytesIO(response.content))
    chart_paths = [n for n in archive.namelist() if n.endswith("chart.json")]
    assert len(chart_paths) == 1
    chart = json.loads(archive.read(chart_paths[0]))
    assert "series" in chart


def test_interactive_export_with_scrolly_requires_upload(
    client, seeded_story_with_scrolly_chapter
):
    story_id = seeded_story_with_scrolly_chapter
    response = client.post(f"/api/stories/{story_id}/export/interactive")
    assert response.status_code == 400
    assert "snapshot" in response.json()["detail"]


def test_interactive_export_filename_slug_sanitized(client):
    create_resp = client.post(
        "/api/stories",
        json={
            "title": 'Naïve "Story"/2026 — Q1!',
            "description": "",
            "chapters": [
                {
                    "id": "ch-prose",
                    "order": 0,
                    "type": "prose",
                    "title": "x",
                    "narrative": "y",
                }
            ],
            "published": True,
        },
    )
    assert create_resp.status_code == 201, create_resp.text
    story_id = create_resp.json()["id"]
    response = client.post(f"/api/stories/{story_id}/export/interactive")
    assert response.status_code == 200, response.text
    cd = response.headers["content-disposition"]
    # Must be ASCII-only and contain only safe filename chars.
    assert '"' in cd  # quoted filename
    assert "/" not in cd.split('filename="', 1)[1]
    assert "Na" in cd  # ASCII-folded
    assert '"Story"' not in cd  # quotes stripped


def test_interactive_export_with_scrolly_upload_succeeds(
    client, seeded_story_with_scrolly_chapter
):
    story_id = seeded_story_with_scrolly_chapter
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
    response = client.post(
        f"/api/stories/{story_id}/export/interactive",
        files=[("scrolly_pngs", ("ch-scrolly.png", png, "image/png"))],
    )
    assert response.status_code == 200, response.text
    archive = zipfile.ZipFile(io.BytesIO(response.content))
    assert "chapters/ch-scrolly/snapshot.png" in archive.namelist()
    assert archive.read("chapters/ch-scrolly/snapshot.png") == png
