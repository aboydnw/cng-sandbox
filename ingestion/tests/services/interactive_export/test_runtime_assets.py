from pathlib import Path

from src.services.interactive_export import runtime_assets

FAKE = Path(__file__).parent / "fixtures" / "fake_runtime"


def test_copy_into_copies_bundle_js_and_css(tmp_path, monkeypatch):
    monkeypatch.setattr(runtime_assets, "RUNTIME_DIR", FAKE)
    runtime_assets.copy_into(tmp_path)
    runtime_dir = tmp_path / "runtime"
    assert (runtime_dir / "bundle.js").read_text() == 'console.log("fake")\n'
    assert (runtime_dir / "bundle.css").read_text() == "body { background: white; }\n"


def test_copy_into_falls_back_quietly_when_runtime_missing(tmp_path, monkeypatch):
    monkeypatch.setattr(runtime_assets, "RUNTIME_DIR", tmp_path / "nope")
    runtime_assets.copy_into(tmp_path)
    assert not (tmp_path / "runtime" / "bundle.js").exists()


def test_is_available_returns_true_when_bundle_js_exists(monkeypatch):
    monkeypatch.setattr(runtime_assets, "RUNTIME_DIR", FAKE)
    assert runtime_assets.is_available() is True


def test_is_available_returns_false_when_missing(monkeypatch, tmp_path):
    monkeypatch.setattr(runtime_assets, "RUNTIME_DIR", tmp_path / "nope")
    assert runtime_assets.is_available() is False
