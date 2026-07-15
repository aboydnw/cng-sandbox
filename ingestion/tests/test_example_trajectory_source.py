from src.services.example_datasets import example_dataset_id
from src.services.example_trajectory_source import STORK_SOURCE_URL


def test_stork_source_url_is_stable():
    assert (
        example_dataset_id(STORK_SOURCE_URL) == "a04e2ccc-25cc-52e1-908c-5add6d29b7f6"
    )
