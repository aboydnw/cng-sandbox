# Changelog

## [1.6.0](https://github.com/aboydnw/cng-sandbox/compare/v1.5.0...v1.6.0) (2026-03-30)


### Features

* add agentic development pipeline ([#53](https://github.com/aboydnw/cng-sandbox/issues/53)) ([4b49bd3](https://github.com/aboydnw/cng-sandbox/commit/4b49bd37152eaba16cdba7d1abc40c075d359bb4))
* cloud-optimized data connections ([#67](https://github.com/aboydnw/cng-sandbox/issues/67)) ([a4ac6f1](https://github.com/aboydnw/cng-sandbox/commit/a4ac6f1eacdf2de072755332618bbe63d41454e7))
* geostationary satellite reprojection for NetCDF conversion ([#60](https://github.com/aboydnw/cng-sandbox/issues/60)) ([251f977](https://github.com/aboydnw/cng-sandbox/commit/251f977cb6382f0a37560d409fedd4671fbe58af))
* map zooms to data bounds in story editor ([#69](https://github.com/aboydnw/cng-sandbox/issues/69)) ([2cf151a](https://github.com/aboydnw/cng-sandbox/commit/2cf151a57695d8c4bc062eb1d3efbfbca24d5bbc))
* replace boto3 with obstore for S3/R2 object storage ([#71](https://github.com/aboydnw/cng-sandbox/issues/71)) ([ec86916](https://github.com/aboydnw/cng-sandbox/commit/ec86916d80a629a5507252f5b20bbf1c62293862))
* switch datasets and connections from map page ([#70](https://github.com/aboydnw/cng-sandbox/issues/70)) ([6baacbf](https://github.com/aboydnw/cng-sandbox/commit/6baacbf7926228876162527be5ef376035d86fd8))


### Bug Fixes

* consolidate colormap definitions and lowercase keys for titiler compatibility ([#59](https://github.com/aboydnw/cng-sandbox/issues/59)) ([97f57ec](https://github.com/aboydnw/cng-sandbox/commit/97f57ec567ade799c8204a16d7459424ef863aac))
* migrate from DuckDNS to custom domain and fix prod build ([#77](https://github.com/aboydnw/cng-sandbox/issues/77)) ([b18f0af](https://github.com/aboydnw/cng-sandbox/commit/b18f0afc037cb16aacd0a88c8a28e0089078cb1a))
* use correct claude-code-action API parameters ([#58](https://github.com/aboydnw/cng-sandbox/issues/58)) ([30da82e](https://github.com/aboydnw/cng-sandbox/commit/30da82eb044a649e14b227f3dbef8cbc95a98326))

## [1.5.0](https://github.com/aboydnw/cng-sandbox/compare/v1.4.0...v1.5.0) (2026-03-26)


### Features

* improve homepage cards with descriptive content and story expansion ([#43](https://github.com/aboydnw/cng-sandbox/issues/43)) ([2907caf](https://github.com/aboydnw/cng-sandbox/commit/2907caf547916febd8ef4bd811f813f2220142e4))

## [1.4.0](https://github.com/aboydnw/cng-sandbox/compare/v1.3.0...v1.4.0) (2026-03-26)


### Features

* combine datasets and stories into Library page ([#35](https://github.com/aboydnw/cng-sandbox/issues/35)) ([103f638](https://github.com/aboydnw/cng-sandbox/commit/103f638e025dffaec0c82780b348eff1b05c44e6))


### Bug Fixes

* add vector view mode toggle for PMTiles vs GeoParquet ([#39](https://github.com/aboydnw/cng-sandbox/issues/39)) ([34fb9aa](https://github.com/aboydnw/cng-sandbox/commit/34fb9aaa3c912e98888ec3d964648741c56dc145)), closes [#22](https://github.com/aboydnw/cng-sandbox/issues/22)
* improve HDF5 converter robustness for NISAR data ([#40](https://github.com/aboydnw/cng-sandbox/issues/40)) ([30bd477](https://github.com/aboydnw/cng-sandbox/commit/30bd477f39c7bc807f63a32cd8278f443d577358))

## [1.3.0](https://github.com/aboydnw/cng-sandbox/compare/v1.2.0...v1.3.0) (2026-03-25)


### Features

* story editor UX overhaul ([#27](https://github.com/aboydnw/cng-sandbox/issues/27)) ([bf1f9f2](https://github.com/aboydnw/cng-sandbox/commit/bf1f9f2d8dc59c43a00edf94e56c9dafe08b25ed))


### Bug Fixes

* extract CRS name from WKT instead of missing .name attribute ([#34](https://github.com/aboydnw/cng-sandbox/issues/34)) ([fec81f6](https://github.com/aboydnw/cng-sandbox/commit/fec81f6186a474698e87376f5eb8180e209ee207)), closes [#33](https://github.com/aboydnw/cng-sandbox/issues/33)
* include pipeline error message in bug reports ([#32](https://github.com/aboydnw/cng-sandbox/issues/32)) ([cbc6c0a](https://github.com/aboydnw/cng-sandbox/commit/cbc6c0aa50211a6ccec09aa8437f468920cd55ee))
* serialize Error objects in console capture (closes [#21](https://github.com/aboydnw/cng-sandbox/issues/21)) ([#29](https://github.com/aboydnw/cng-sandbox/issues/29)) ([cbb167d](https://github.com/aboydnw/cng-sandbox/commit/cbb167d82468458bfc5a67464dab69c92509b8f4))

## [1.2.0](https://github.com/aboydnw/cng-sandbox/compare/v1.1.0...v1.2.0) (2026-03-25)


### Features

* add workspace-based data isolation ([#26](https://github.com/aboydnw/cng-sandbox/issues/26)) ([c776754](https://github.com/aboydnw/cng-sandbox/commit/c77675485bed79ec0e67be89e659baf48111e438))
* details drawer redesign with interactive pipeline timeline ([#24](https://github.com/aboydnw/cng-sandbox/issues/24)) ([f3eb798](https://github.com/aboydnw/cng-sandbox/commit/f3eb798781d3b176e49fa9c9f4e4db986b4d40f7))


### Bug Fixes

* center homepage subtitle text ([#14](https://github.com/aboydnw/cng-sandbox/issues/14)) ([a572432](https://github.com/aboydnw/cng-sandbox/commit/a57243223d6c1ebe1f4a5e7d133783279e0eb978))

## [1.1.0](https://github.com/aboydnw/cng-sandbox/compare/v1.0.0...v1.1.0) (2026-03-24)


### Features

* serve production frontend as static files via Caddy ([#10](https://github.com/aboydnw/cng-sandbox/issues/10)) ([8025ac1](https://github.com/aboydnw/cng-sandbox/commit/8025ac1a6fe55e47791a0d7e2c954594d9585a80))


### Bug Fixes

* add release-please config and manifest for proper version tracking ([45536e4](https://github.com/aboydnw/cng-sandbox/commit/45536e4035025f0e4a60af3cbbb4f5c3b1b650eb))
* improve icon+text spacing across all frontend components ([dd34c0c](https://github.com/aboydnw/cng-sandbox/commit/dd34c0c5e5479e7b0b6342aa8e833b2d6ced23a3))

## 1.0.0 (2026-03-24)


### Features

* accept .h5 and .hdf5 in file uploader ([9d43840](https://github.com/aboydnw/cng-sandbox/commit/9d438408c3c3eaf0ee54612e2b1720602a8bd01a))
* accept job_id as bug report context for upload errors ([0f48a54](https://github.com/aboydnw/cng-sandbox/commit/0f48a54bf45d97e351b19d72a696ed89288f56e5))
* add /story/:id/embed route for iframe embedding ([cebd19b](https://github.com/aboydnw/cng-sandbox/commit/cebd19baf6e6d6619e3864c4806c0f3a7602dfa6))
* add bug report API client ([f240e6d](https://github.com/aboydnw/cng-sandbox/commit/f240e6da9f375aa3ee8455df715c3af1371109f9))
* add bug report modal and link components ([0b6d186](https://github.com/aboydnw/cng-sandbox/commit/0b6d18621e2e107d4d2055e6710c62031f3a903a))
* add Caddy reverse proxy with prod profile and CORS fix ([3068f74](https://github.com/aboydnw/cng-sandbox/commit/3068f74a9ee416bff2d6fc969d2c60103f3ceeea))
* add Caddyfile with TLS, basic auth, and gzip ([98e1c95](https://github.com/aboydnw/cng-sandbox/commit/98e1c95e4a24ce4d9286f27128d4ca5532e2717a))
* add CameraState type and helpers for unified map ([06b166f](https://github.com/aboydnw/cng-sandbox/commit/06b166f81216bc0e9b3b6ce78d089318d82a2479))
* add chapter type dropdown to NarrativeEditor ([af045f1](https://github.com/aboydnw/cng-sandbox/commit/af045f1bc716338a593b1088e815d75e615f1971))
* add ChapterType discriminator to Chapter interface ([ed2016c](https://github.com/aboydnw/cng-sandbox/commit/ed2016c7dbbb1e360309ac11cba6a20e4cc8a37d))
* add client-side COG rendering with deck.gl-geotiff ([ec11885](https://github.com/aboydnw/cng-sandbox/commit/ec11885455e1f1cb2526388f9e71b7df84a45500))
* add cog_url field to Dataset model ([f590b26](https://github.com/aboydnw/cng-sandbox/commit/f590b263bd602ef865ff89a938bf1eed4d74ee07))
* add cog_url field to Dataset type ([d2f61f0](https://github.com/aboydnw/cng-sandbox/commit/d2f61f0d8b31e959ff1740513e125ec97a6a74af))
* add computed dataset_ids to story API response ([b195132](https://github.com/aboydnw/cng-sandbox/commit/b1951323e4ec76a77003776cac601128148b9178))
* add console log capture ring buffer for bug reports ([7c2bbea](https://github.com/aboydnw/cng-sandbox/commit/7c2bbea4a3a67be234c1039005a3493db0acd647))
* add ConversionSummaryCard component ([3023fd8](https://github.com/aboydnw/cng-sandbox/commit/3023fd80aeb77dc9175dbe6f32c175a1684c0046))
* add custom Caddy image with DuckDNS DNS plugin ([3f7e8b4](https://github.com/aboydnw/cng-sandbox/commit/3f7e8b4ba8e67f4fc9365bdbb387997967bb2f85))
* add dataset upload modal to story editor ([22e40a1](https://github.com/aboydnw/cng-sandbox/commit/22e40a1398e82d3ff6935543d67c8738984e0029))
* add dataset_id to LayerConfig and dataset_ids to Story ([c107759](https://github.com/aboydnw/cng-sandbox/commit/c107759e51f352dcb78f26240a3641c6bba6d543))
* add DatasetRow SQLAlchemy model for persistent dataset storage ([0952eef](https://github.com/aboydnw/cng-sandbox/commit/0952eef45979eefefda71f6e526b3221037520f2))
* add datasets management page with browse and delete ([919730f](https://github.com/aboydnw/cng-sandbox/commit/919730f47e31d8f98711ecae145a29b2b7569196))
* add DELETE /api/datasets/{id} with cascading cleanup ([d74f03f](https://github.com/aboydnw/cng-sandbox/commit/d74f03ff1cc6138a4fedb6c4041b74b4c6c2039f))
* add delete_object and delete_prefix to StorageService ([1dd2645](https://github.com/aboydnw/cng-sandbox/commit/1dd264575d76403b6c3d6de37222383aec40cf72))
* add deployment env vars for Caddy and DuckDNS ([3201035](https://github.com/aboydnw/cng-sandbox/commit/32010355dbf8d603abc637ecf8ea3c039ac9673a))
* add DirectRasterMap component using COGLayer ([1adf9c3](https://github.com/aboydnw/cng-sandbox/commit/1adf9c3f7c4598be5388bc82f23ab79d7b941ba7))
* add DuckDNS IP update script for cron ([1e99fd6](https://github.com/aboydnw/cng-sandbox/commit/1e99fd67ffcec8232ff66959cbecf8c1cee0e8f4))
* add embedded prop to FileUploader to hide headline when inside PathCard ([65b4cd0](https://github.com/aboydnw/cng-sandbox/commit/65b4cd09aae5de47d988d40cdb73711842d633c9))
* add error boundary to MapPage ([b7fb085](https://github.com/aboydnw/cng-sandbox/commit/b7fb085344602852515e04dc60053f0567f02f99))
* add frontend API client for story CRUD ([c81c1bb](https://github.com/aboydnw/cng-sandbox/commit/c81c1bb3571fa04de2b1393c74af5127565a7358))
* add GeoJSON structure validation to vector upload path ([55a6b33](https://github.com/aboydnw/cng-sandbox/commit/55a6b33ce52f8baf61dee35f0c2068e6c98855dc))
* add HDF5 COG validator ([7036e04](https://github.com/aboydnw/cng-sandbox/commit/7036e048ecc6befdd3fb541569d9e86a1ac2771a))
* add HDF5 to COG converter with CRS reprojection ([dc4681a](https://github.com/aboydnw/cng-sandbox/commit/dc4681a22e1cf81977e0d1b253de2e0a32ec689a))
* add HDF5 to format detector MIME whitelist ([4b81a90](https://github.com/aboydnw/cng-sandbox/commit/4b81a907eb2a9a3b73613a20f2b4a713504342e0))
* add HDF5_TO_COG format pair and scan fields on Job model ([753c782](https://github.com/aboydnw/cng-sandbox/commit/753c782dd3e47be26878e27ac25c44e5f64e6d7d))
* add HomepageHero component for redesigned landing page ([7bac826](https://github.com/aboydnw/cng-sandbox/commit/7bac8265cc89ec988ddc9191a3b2edb1e3b8a022))
* add InlineUpload component for side panel upload flow ([bd65920](https://github.com/aboydnw/cng-sandbox/commit/bd6592046b52b4f850a531e5cb37c1114a161a89))
* add job_id support to frontend bug report payload and modal ([9e4f557](https://github.com/aboydnw/cng-sandbox/commit/9e4f55737c79093a4a4de4c622f9ec2ef4663aff))
* add LayerConfig to Chapter type for per-chapter styling ([2529378](https://github.com/aboydnw/cng-sandbox/commit/2529378737cd1182f57327109b02db517bfd4b1e))
* add MapChapter reader component with zoom controls and legend ([029984b](https://github.com/aboydnw/cng-sandbox/commit/029984be7cd127da6b15852897c990acce825213))
* add migrateStory and update API client for multi-dataset stories ([98d0b36](https://github.com/aboydnw/cng-sandbox/commit/98d0b3658efe8472fa35be9679903f7772827d8e))
* add MVTLayer-based vector layer builder ([0e6e35e](https://github.com/aboydnw/cng-sandbox/commit/0e6e35ebbef89ec95943fc839ed0cb7342e0cf0d))
* add PathCard component with expand/collapse animation ([43ca158](https://github.com/aboydnw/cng-sandbox/commit/43ca15887970bb3ced4c36e5f9688b49fb930dd0))
* add per-chapter dataset picker to NarrativeEditor ([0cd5f99](https://github.com/aboydnw/cng-sandbox/commit/0cd5f999d145f478775d97f6bd1ab2e65dc30f22))
* add per-chapter layer styling controls in editor ([08695a1](https://github.com/aboydnw/cng-sandbox/commit/08695a185272788d6b97a530476bf3d892140fb4))
* add POST /api/bug-report endpoint for GitHub issue creation ([95f909e](https://github.com/aboydnw/cng-sandbox/commit/95f909ecf9fd5847b824ee45372d4908b25b74fe))
* add POST /api/scan/{scan_id}/convert endpoint ([73f3c82](https://github.com/aboydnw/cng-sandbox/commit/73f3c82b1e859ac5a771979b4af31de5cef01adb))
* add ProseChapter reader component ([a252ae8](https://github.com/aboydnw/cng-sandbox/commit/a252ae80d2a8879248edd42f3490481312c1a0fb))
* add RasterSidebarControls for sidebar layout ([93149c4](https://github.com/aboydnw/cng-sandbox/commit/93149c4e62579ee4fb4bc1c76ee5cf2c3026dad8))
* add retry and report buttons to ProgressTracker error state ([2ebdccf](https://github.com/aboydnw/cng-sandbox/commit/2ebdccfb2013eba82ae5c3a3f5502393f67b24ae))
* add retry logic to API calls and SSE reconnection ([2f85e9b](https://github.com/aboydnw/cng-sandbox/commit/2f85e9b3a4cede30be6d2295283e3add72ee4444))
* add rio-stac, pystac, geojson-pydantic dependencies ([3daf828](https://github.com/aboydnw/cng-sandbox/commit/3daf8283280949641047b0da9651c808e1a13995))
* add scan-pause-resume flow for variable selection in pipeline ([8d6202f](https://github.com/aboydnw/cng-sandbox/commit/8d6202fe4cfeff4ff555ac91f53f4eb794835a50))
* add SidePanel component replacing CreditsPanel ([8cc4f78](https://github.com/aboydnw/cng-sandbox/commit/8cc4f784345aaeb6765553501333cf4ff70cd682))
* add SQLAlchemy Story model and Pydantic schemas ([c028354](https://github.com/aboydnw/cng-sandbox/commit/c028354059cbae11892864a8aa78a34e8d430167))
* add story CRUD API endpoints with tests ([f459653](https://github.com/aboydnw/cng-sandbox/commit/f459653defd0988f451352922a87c5cfc53f9c2b))
* add story data model types ([435b25b](https://github.com/aboydnw/cng-sandbox/commit/435b25b01bfb772d13ed2568f89cd59abb51972a))
* add story editor with chapter list, narrative editor, and map capture ([570a637](https://github.com/aboydnw/cng-sandbox/commit/570a637d7b3dd2a3e839577aedce530dfd1fd130))
* add story localStorage CRUD with tests ([ad04c5a](https://github.com/aboydnw/cng-sandbox/commit/ad04c5ac183d4ebb3333e468d96c5d082c58fad7))
* add story reader page with scrollama transitions ([25e1d6c](https://github.com/aboydnw/cng-sandbox/commit/25e1d6cc010ce2c76af5c765c0626a5d8d53e36d))
* add story routes to App.tsx ([68d9713](https://github.com/aboydnw/cng-sandbox/commit/68d97134a837af34d219aa7a52fd6090c5a64b47))
* add StoryCTABanner component with prose+map chapter template ([044e610](https://github.com/aboydnw/cng-sandbox/commit/044e610587d27d056ba3c0fd686424e341324789))
* add tech description data for deep dive panel ([6a99428](https://github.com/aboydnw/cng-sandbox/commit/6a9942882df87101af9eb41230a6247101a812f7))
* add TechCard component for deep dive panel ([55225b4](https://github.com/aboydnw/cng-sandbox/commit/55225b4fc204394a62c84165ddffc6549e9d17e7))
* add Tile Server / Client Rendering tab for raster datasets ([63d06cd](https://github.com/aboydnw/cng-sandbox/commit/63d06cd684984476f0c9b0b75f17fab718a4aaa8))
* add triage prompt for daily automated issue review ([75cc2f3](https://github.com/aboydnw/cng-sandbox/commit/75cc2f3938df25f120f316028911cff6c62fdeaa))
* add triage wrapper script with pre-flight checks and timeout ([b1bb135](https://github.com/aboydnw/cng-sandbox/commit/b1bb13579804f296fb60a8d71bd303fa24d924fc))
* add TTL cleanup for expired scan entries ([59704c1](https://github.com/aboydnw/cng-sandbox/commit/59704c100c9cf8bebe5245f90d6e8a8cd8ff2410))
* add type field to ChapterPayload with scrollytelling default ([7053e9c](https://github.com/aboydnw/cng-sandbox/commit/7053e9ce4670bd8ca0db33ec3dc848f8559abe9d))
* add UnifiedMap component with shared camera state ([569f172](https://github.com/aboydnw/cng-sandbox/commit/569f17298dcf09ebda2ab569bfa1ddbceb0a57e0))
* add variable scanner for HDF5 and NetCDF files ([4307fa1](https://github.com/aboydnw/cng-sandbox/commit/4307fa16ae9be9a9a88ce588209bb05b9036fc9a))
* add VariablePicker component for HDF5/NetCDF variable selection ([ac7bc29](https://github.com/aboydnw/cng-sandbox/commit/ac7bc29bf65d83d60b75153a9bfc3d9c44716dcc))
* add VectorPopup overlay for deck.gl vector interactions ([41711d5](https://github.com/aboydnw/cng-sandbox/commit/41711d5df6142e4540862bc4c02b97c2bbd26da2))
* allow creating stories without a dataset from the homepage ([aa46200](https://github.com/aboydnw/cng-sandbox/commit/aa46200060c9b084c62b57935de643f68bd51b96))
* conditionally show map preview based on chapter type ([957358b](https://github.com/aboydnw/cng-sandbox/commit/957358b2615ffbbc6b1ed5f5a923ae4d00cd3ca3))
* editor supports per-chapter dataset selection ([34c0d69](https://github.com/aboydnw/cng-sandbox/commit/34c0d696ca9c84b92bce9f9be37f2d93efc262f3))
* emit scan_result SSE event for variable selection ([6211ed7](https://github.com/aboydnw/cng-sandbox/commit/6211ed7cc5205285ad38cb8a821432b0785d58db))
* extend UnifiedMap with optional fly-to transition support ([42cac5a](https://github.com/aboydnw/cng-sandbox/commit/42cac5a9ed7125d2205320d5cb9bb012554f8cd9))
* extract COG client-side layer builder from DirectRasterMap ([37a1dd4](https://github.com/aboydnw/cng-sandbox/commit/37a1dd4334caed727db47ddf3118ce2d2458f3b6))
* extract GeoJSON layer builder from DuckDBMap ([d61bb84](https://github.com/aboydnw/cng-sandbox/commit/d61bb8417a3d546ef87926c34d1c6d30ec4bd245))
* extract PixelInspector overlay from DirectRasterMap ([050352f](https://github.com/aboydnw/cng-sandbox/commit/050352f36eb07ef87e76d61f6bb92f43c7066360))
* extract raster tile layer builder from RasterMap ([7e07545](https://github.com/aboydnw/cng-sandbox/commit/7e07545d3c4aca122374d6359e01aa2c6ad6afdd))
* extract RasterControls overlay from RasterMap ([280d455](https://github.com/aboydnw/cng-sandbox/commit/280d455616e28791d50ae24c1f64e93dde5f2c2a))
* extract shared SQLAlchemy Base to models/base.py ([d9f4a2f](https://github.com/aboydnw/cng-sandbox/commit/d9f4a2ff588649fb6c7075ce0817adaa88afe43a))
* handle scan_result SSE and add confirmVariable to upload hook ([82548e7](https://github.com/aboydnw/cng-sandbox/commit/82548e7c7e3fb273d627acf2f390020a889a75f5))
* HDF5 file upload with variable selection ([d9333a0](https://github.com/aboydnw/cng-sandbox/commit/d9333a0bc9ee5222856899514b7a6a934e4c70eb))
* initialize CNG Sandbox as standalone repo ([fe4468d](https://github.com/aboydnw/cng-sandbox/commit/fe4468d7e11dbbdc31687a38a65d6ad4be4ffb16))
* initialize stories table on app startup ([a963bab](https://github.com/aboydnw/cng-sandbox/commit/a963babfe3631aaa9e9c720a2f07fae596ce3d45))
* make dataset_id optional for story creation ([9d3d50c](https://github.com/aboydnw/cng-sandbox/commit/9d3d50c354d77a7cfe8856052a17bab0e1225334))
* make dataset_id optional in frontend story types and helpers ([c664a17](https://github.com/aboydnw/cng-sandbox/commit/c664a17e31a35f26d6cbadcb7ededac0c0de9b21))
* make header logo a clickable home link ([cd9acda](https://github.com/aboydnw/cng-sandbox/commit/cd9acda0b419cf47e8549ef6481ace9c96272a9f))
* migrate chapters without type to scrollytelling ([14b19c2](https://github.com/aboydnw/cng-sandbox/commit/14b19c2b7266c18ac172f04c8ffd5b9c859c661d))
* migrate story editor from localStorage to API persistence ([e81ba2b](https://github.com/aboydnw/cng-sandbox/commit/e81ba2ba2b2c8ad98b830a09719404cc03e8dd02))
* migrate story reader from localStorage to API persistence ([186ae4f](https://github.com/aboydnw/cng-sandbox/commit/186ae4f5821ac833af11a9231c32d884eb33c5cd))
* persist datasets to PostgreSQL via pipeline ([8ec5c5b](https://github.com/aboydnw/cng-sandbox/commit/8ec5c5b04df47ab41f9cc9d5e511e2367fc16b7f))
* **pixel-inspector:** add floating tooltip UI ([2a80d9c](https://github.com/aboydnw/cng-sandbox/commit/2a80d9c8d7fb1fe6da18e4e2189ec34d66d032c2))
* **pixel-inspector:** add hover handler with coordinate lookup ([bbfd1af](https://github.com/aboydnw/cng-sandbox/commit/bbfd1af2d762a254c6c705e28c0b8c7d16e184b0))
* **pixel-inspector:** add tile data cache in getTileData ([aa29e32](https://github.com/aboydnw/cng-sandbox/commit/aa29e323db9a9c9b37a28c90271a0e9e7c5896e2))
* populate cog_url for raster datasets in pipeline ([8edc0ae](https://github.com/aboydnw/cng-sandbox/commit/8edc0aea51bc7ba91b6267c372c9c0292d577751))
* reader supports multi-dataset stories with graceful degradation ([50074d1](https://github.com/aboydnw/cng-sandbox/commit/50074d10fe1f05314e066fd5f967f0892affc18c))
* reader uses per-chapter LayerConfig for styling ([00e4837](https://github.com/aboydnw/cng-sandbox/commit/00e4837e7da99078d0af2b8c56e1f58d8cb6bfc5))
* render chapters by type — prose, map, scrollytelling ([7119bab](https://github.com/aboydnw/cng-sandbox/commit/7119bab46c07146d65fa5a0b92d609bc0b22b0fe))
* restructure MapPage with new SidePanel and renderMode ([02ee3b1](https://github.com/aboydnw/cng-sandbox/commit/02ee3b16d31ef3dc2dafd3ba4d120834ad234142))
* rework ReportCard into tech deep dive panel ([65e23d1](https://github.com/aboydnw/cng-sandbox/commit/65e23d1034699de9cb2bd35d77d07c85a7a7bca4))
* rewrite dataset endpoints to read from PostgreSQL ([d67003e](https://github.com/aboydnw/cng-sandbox/commit/d67003eb05a25bf141cd9be9766a5360a96c5beb))
* rewrite homepage with two-card layout and inline upload flow ([f59a912](https://github.com/aboydnw/cng-sandbox/commit/f59a912c3a5d2f20ce6c62bb504563ec7d89cfca))
* rewrite stac_ingest with rio-stac and pystac ([9ccfa08](https://github.com/aboydnw/cng-sandbox/commit/9ccfa08923ca039874a9b3bcc7550bbe6607e83a))
* share button with clipboard copy animation and render-mode-aware details ([714adf1](https://github.com/aboydnw/cng-sandbox/commit/714adf1d086c66afea5344689518f8e88fd8d470))
* show chapter type indicator in sidebar ([e7cadd4](https://github.com/aboydnw/cng-sandbox/commit/e7cadd421e8c11d05a39247270bd5b7155aef0ef))
* show VariablePicker in upload flow for HDF5/NetCDF files ([a4136fd](https://github.com/aboydnw/cng-sandbox/commit/a4136fde9edbd98d2ac3df7c965d9195de8d6854))
* wire bug report link into map and story pages ([f031c8e](https://github.com/aboydnw/cng-sandbox/commit/f031c8e217339ce4148acce79fcf5294de93afc1))
* wire CreditsPanel story CTA to internal editor route ([fb7dd8e](https://github.com/aboydnw/cng-sandbox/commit/fb7dd8eb9c3283367a5ef523cf6219b94b30a98a))
* wire HDF5 converter into pipeline with variable/group forwarding ([fd11de3](https://github.com/aboydnw/cng-sandbox/commit/fd11de3fb38da3009705ef21e3a8bc434d32a984))


### Bug Fixes

* add colormap_name to raster tile URLs in story pages ([d1350f2](https://github.com/aboydnw/cng-sandbox/commit/d1350f2242e52e6b96ea7cc199722075686b47bc))
* add crypto.randomUUID fallback for non-secure contexts ([e3806e3](https://github.com/aboydnw/cng-sandbox/commit/e3806e349e8900ac6c3af5c6d89bf06190e3eeb9))
* add rescale to story tile URLs and fix editor map interaction ([d3556e5](https://github.com/aboydnw/cng-sandbox/commit/d3556e5e32cc393d7f22292e8c5d57362dc86286))
* address code review — add id param, rename onViewportLoad to getLoadCallback ([da902c1](https://github.com/aboydnw/cng-sandbox/commit/da902c108c3082e70e7d8af6245f166329236508))
* address code review findings for bug report feature ([6ac78e1](https://github.com/aboydnw/cng-sandbox/commit/6ac78e149b42d3401a11baf835ac70843bedb02f))
* address code review findings for multi-dataset stories ([6371522](https://github.com/aboydnw/cng-sandbox/commit/6371522e6c8d4809633c9d73d5d44558cbc57761))
* address code review issues in HDF5 feature ([9939460](https://github.com/aboydnw/cng-sandbox/commit/99394601a02efe08a7866864657f4fd4e5d8bb6b))
* align sidebar and deep dive styling with site design language ([9f57415](https://github.com/aboydnw/cng-sandbox/commit/9f5741523593039682bf30ec842e6b871f898a7a))
* **ci:** switch frontend to npm and add pystac validation dep ([139309d](https://github.com/aboydnw/cng-sandbox/commit/139309d32e9b7b97182c8c8581b6badb6ad91803))
* disable map interaction in scrollytelling chapters ([a3a32e9](https://github.com/aboydnw/cng-sandbox/commit/a3a32e9bea95825ad6524675b7b487ac5d8aac53))
* DRY vector layer config, add optional id param ([d5cad4b](https://github.com/aboydnw/cng-sandbox/commit/d5cad4b66d408faead28b00fffceea3d258badd3))
* guard navigator.clipboard calls for non-secure contexts ([55bcf99](https://github.com/aboydnw/cng-sandbox/commit/55bcf99911202a2690147dbf6340290fd0c3c0bd))
* **pixel-inspector:** use dataset bounds for tile extent lookup ([41e0f80](https://github.com/aboydnw/cng-sandbox/commit/41e0f808d2d744d3315d5536e69ead310a3b823d))
* PMTiles MVTLayer integration — use loaders.gl for tile parsing ([12ba771](https://github.com/aboydnw/cng-sandbox/commit/12ba77195219fdc2e73e1e1e06a3bf565c7cb991))
* polish homepage layout — fit expanded card in viewport, make cards clickable ([738903d](https://github.com/aboydnw/cng-sandbox/commit/738903debe6392ccebf8a1461e77ef9b3083b589))
* prevent triage agent from entering plan mode ([056473c](https://github.com/aboydnw/cng-sandbox/commit/056473cf837f37d3da9907952abffc290643e032))
* register hdf5_to_cog package in cng-toolkit pyproject.toml ([8c5155a](https://github.com/aboydnw/cng-sandbox/commit/8c5155a250a51fa0fd609997695682aa30872009))
* resolve PMTiles 400 errors through Caddy reverse proxy ([685b0f7](https://github.com/aboydnw/cng-sandbox/commit/685b0f7875dd7ddc4546eae9a840c7910cbf9b0c))
* resolve publish race condition and improve API error handling ([8900b5b](https://github.com/aboydnw/cng-sandbox/commit/8900b5ba6af9bb90f135dde9244607c39f74706b))
* restore Scrollama scroll-driven transitions for scrollytelling blocks ([191d164](https://github.com/aboydnw/cng-sandbox/commit/191d1640cb895930ff5c110cda7971d3cfccf8c2))
* stabilize fetchWithRetry network error test ([61ec897](https://github.com/aboydnw/cng-sandbox/commit/61ec89788edaf2f99b95f681f1a7ec87bb5bd209))
* unify side panel card designs and improve control affordances ([8e60251](https://github.com/aboydnw/cng-sandbox/commit/8e602512599a980bec9d01ae41b0305689de3d60))
* use bypassPermissions for headless triage execution ([2395b05](https://github.com/aboydnw/cng-sandbox/commit/2395b05b9c86409f73b9f3491fb266517dbb90f3))
* use ordered list for coordinate name lookup in HDF5 converter ([929b195](https://github.com/aboydnw/cng-sandbox/commit/929b19552b4c174a7ae468ce79c27207edbf3ac2))
* use ordered lists for coordinate name lookup in HDF5 validator ([6cb6134](https://github.com/aboydnw/cng-sandbox/commit/6cb6134627e15370e97755ea513d27a36c0deac4))
* use string | null for cog_url type to match API response format ([7ac1c87](https://github.com/aboydnw/cng-sandbox/commit/7ac1c87f7eb977a26e2d408a72b91208fde1a738))
