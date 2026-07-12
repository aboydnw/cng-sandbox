"""Trajectory pipeline: parse GPX -> GeoParquet + trips.json -> store."""

import logging

import geopandas as gpd
import movingpandas as mpd

logger = logging.getLogger(__name__)


class TrajectoryError(Exception):
    """Raised for a GPX we cannot animate (no time, too few points, too big)."""


def parse_gpx_to_trajectories(path: str) -> mpd.TrajectoryCollection:
    """Read a GPX file's track points into a cleaned MovingPandas collection.

    GPX is WGS84. Raises TrajectoryError if points lack timestamps or a track
    has fewer than two points.
    """
    gdf = gpd.read_file(path, layer="track_points")
    if "time" not in gdf.columns or gdf["time"].isna().all():
        raise TrajectoryError(
            "This GPX has no timestamps. Movement animation needs a time for "
            "each point."
        )
    gdf = gdf.dropna(subset=["time"]).copy()
    gdf["time"] = gpd.pd.to_datetime(gdf["time"], utc=True)
    # GPX track_points carry a per-track id in `track_fid`.
    traj_col = "track_fid" if "track_fid" in gdf.columns else None
    if traj_col is None:
        gdf["track_fid"] = 0
        traj_col = "track_fid"

    tc = mpd.TrajectoryCollection(
        gdf.set_index("time"), traj_id_col=traj_col, crs="EPSG:4326"
    )
    tc = mpd.TrajectoryCollection([t for t in tc.trajectories if t.size() >= 2])
    if len(tc.trajectories) == 0:
        raise TrajectoryError(
            "This GPX has no track with at least two timestamped points."
        )
    tc.add_speed(overwrite=True, units=("km", "h"))
    return tc


def write_trajectory_parquet(tc: mpd.TrajectoryCollection, out_path: str) -> dict:
    """Flatten a collection to one row per ping and write GeoParquet.

    Returns summary metadata (track/point counts, ISO time range, WGS84 bounds).
    """
    frames = []
    for traj in tc.trajectories:
        df = traj.df.copy()
        df = df.reset_index().rename(columns={"time": "timestamp"})
        df["trajectory_id"] = str(traj.id)
        speed_col = (
            "speed" if "speed" in df.columns else df.filter(like="speed").columns[0]
        )
        keep = df[["trajectory_id", "timestamp", "geometry", speed_col]].rename(
            columns={speed_col: "speed"}
        )
        frames.append(keep)

    gdf = gpd.GeoDataFrame(
        gpd.pd.concat(frames, ignore_index=True), geometry="geometry", crs="EPSG:4326"
    )
    gdf["timestamp"] = gpd.pd.to_datetime(gdf["timestamp"], utc=True)
    gdf = gdf.sort_values(["trajectory_id", "timestamp"]).reset_index(drop=True)
    gdf.to_parquet(out_path)

    minx, miny, maxx, maxy = gdf.total_bounds
    return {
        "track_count": len(tc.trajectories),
        "point_count": int(len(gdf)),
        "time_start": gdf["timestamp"].min().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "time_end": gdf["timestamp"].max().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "bounds": [float(minx), float(miny), float(maxx), float(maxy)],
    }


async def run_trajectory_pipeline(job, input_path, db_session_factory) -> None:
    raise NotImplementedError("trajectory pipeline implemented in later tasks")
