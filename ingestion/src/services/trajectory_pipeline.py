"""Trajectory pipeline: parse GPX -> GeoParquet + trips.json -> store."""


async def run_trajectory_pipeline(job, input_path, db_session_factory) -> None:
    raise NotImplementedError("trajectory pipeline implemented in later tasks")
