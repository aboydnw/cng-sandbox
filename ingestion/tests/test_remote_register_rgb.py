from src.services import remote_register


async def test_multiband_dataset_has_no_rescale(monkeypatch):
    async def fake_stats(hrefs):
        raise AssertionError("stats must not be computed for multi-band")

    monkeypatch.setattr(remote_register, "_compute_remote_stats", fake_stats)

    rmin, rmax = await remote_register._resolve_raster_range(
        band_count=3, hrefs=["https://x/visual.tif"]
    )

    assert rmin is None
    assert rmax is None


async def test_singleband_dataset_computes_rescale(monkeypatch):
    async def fake_stats(hrefs):
        return 1.0, 99.0

    monkeypatch.setattr(remote_register, "_compute_remote_stats", fake_stats)

    rmin, rmax = await remote_register._resolve_raster_range(
        band_count=1, hrefs=["https://x/data.tif"]
    )

    assert (rmin, rmax) == (1.0, 99.0)
