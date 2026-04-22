# Changelog

## [1.22.4](https://github.com/aboydnw/cng-sandbox/compare/v1.22.3...v1.22.4) (2026-04-21)


### Bug Fixes

* **frontend:** disable loaders.gl MVT worker so CSP allows vector tiles ([#304](https://github.com/aboydnw/cng-sandbox/issues/304)) ([145a4bd](https://github.com/aboydnw/cng-sandbox/commit/145a4bd1e4a90f95af9d0075dd523e085b746340))
* **frontend:** read tile extent from boundingBox/bbox, not non-existent bounds ([#307](https://github.com/aboydnw/cng-sandbox/issues/307)) ([a004bbe](https://github.com/aboydnw/cng-sandbox/commit/a004bbee4e921424292e23866e128b5b75f25125))
* **ingestion:** drop workspace auth from jobs SSE stream ([#305](https://github.com/aboydnw/cng-sandbox/issues/305)) ([58193e0](https://github.com/aboydnw/cng-sandbox/commit/58193e00572654f3ae757de84e27ef5b06cf3ab7))

## [1.22.3](https://github.com/aboydnw/cng-sandbox/compare/v1.22.2...v1.22.3) (2026-04-21)


### Bug Fixes

* **frontend:** guard pixel inspector against missing sourceTile.bounds ([#302](https://github.com/aboydnw/cng-sandbox/issues/302)) ([2ef06bf](https://github.com/aboydnw/cng-sandbox/commit/2ef06bf64891393ea1603615576522e0d64463ed))
* **ingestion:** upload raw file off event loop ([#300](https://github.com/aboydnw/cng-sandbox/issues/300)) ([389c3ff](https://github.com/aboydnw/cng-sandbox/commit/389c3ff1cee4ac61fe99869cb7523ac19dbf741c))

## [1.22.2](https://github.com/aboydnw/cng-sandbox/compare/v1.22.1...v1.22.2) (2026-04-21)


### Bug Fixes

* **frontend:** read pixel values off the hovered tile, drop shared cache ([#296](https://github.com/aboydnw/cng-sandbox/issues/296)) ([d4de663](https://github.com/aboydnw/cng-sandbox/commit/d4de66395b74702a91bc89b9645cc48194b80729))
* **ingestion:** use nearest resampling for categorical GeoTIFF→COG ([#297](https://github.com/aboydnw/cng-sandbox/issues/297)) ([5be81b7](https://github.com/aboydnw/cng-sandbox/commit/5be81b783bacc9635a000bac5748bad9554068e0))

## [1.22.1](https://github.com/aboydnw/cng-sandbox/compare/v1.22.0...v1.22.1) (2026-04-21)


### Bug Fixes

* **frontend:** look up pixel values by hovered tile, not dataset bounds ([#295](https://github.com/aboydnw/cng-sandbox/issues/295)) ([0a47259](https://github.com/aboydnw/cng-sandbox/commit/0a47259a74c28e60637cf260f3ab1a7ed1d943a7))
* **frontend:** unify URL input and fix empty featured dataset buttons ([#293](https://github.com/aboydnw/cng-sandbox/issues/293)) ([56752c7](https://github.com/aboydnw/cng-sandbox/commit/56752c7ecfbc53dadaf13eb7350ab435d0ecbb24))

## [1.22.0](https://github.com/aboydnw/cng-sandbox/compare/v1.21.0...v1.22.0) (2026-04-21)


### Features

* **backend:** homepage redesign backend — examples, inspect-url, fork ([#284](https://github.com/aboydnw/cng-sandbox/issues/284)) ([8f85d6a](https://github.com/aboydnw/cng-sandbox/commit/8f85d6af291e9fa331259ab68b3a14e319d05cb4))
* **frontend:** client COG rendering for non-Mercator CRSes via deck.gl-geotiff 0.4 ([#263](https://github.com/aboydnw/cng-sandbox/issues/263)) ([9129771](https://github.com/aboydnw/cng-sandbox/commit/9129771ba62fd742646dd7d63991728eee643384))
* **frontend:** redesign homepage to two-card layout with unified URL auto-detection ([#291](https://github.com/aboydnw/cng-sandbox/issues/291)) ([7a2a86e](https://github.com/aboydnw/cng-sandbox/commit/7a2a86eadd321e280620cac58a8c7b5d5265ad43))


### Bug Fixes

* **frontend:** correct technical details panel for categorical + client-rendered rasters ([#292](https://github.com/aboydnw/cng-sandbox/issues/292)) ([1acb91c](https://github.com/aboydnw/cng-sandbox/commit/1acb91c8e5b1c93b992f7ff12a874e27913239a2))

## [1.21.0](https://github.com/aboydnw/cng-sandbox/compare/v1.20.1...v1.21.0) (2026-04-20)


### Features

* **frontend:** surface render mode indicator on shared maps ([#258](https://github.com/aboydnw/cng-sandbox/issues/258)) ([feeea02](https://github.com/aboydnw/cng-sandbox/commit/feeea024c3956855260b4f584fdde4eca0fc60b2))


### Bug Fixes

* **frontend:** legend layout + sidebar scroll + shared map category visibility ([#257](https://github.com/aboydnw/cng-sandbox/issues/257)) ([689a42c](https://github.com/aboydnw/cng-sandbox/commit/689a42ca1180d44cb7183292236d3c40935d2b67))

## [1.20.1](https://github.com/aboydnw/cng-sandbox/compare/v1.20.0...v1.20.1) (2026-04-20)


### Bug Fixes

* **frontend:** complete proj4 defs for client COG renderer ([#253](https://github.com/aboydnw/cng-sandbox/issues/253)) ([d272d3b](https://github.com/aboydnw/cng-sandbox/commit/d272d3b01b12d89b124ec874c4829b2c45b89698))
* **frontend:** force server render for COGs not in EPSG:3857 ([#254](https://github.com/aboydnw/cng-sandbox/issues/254)) ([e3e9c2d](https://github.com/aboydnw/cng-sandbox/commit/e3e9c2d61d35a98f1427d741c436091c4053d0f3))
* **frontend:** portal-wrap Chakra dialogs + add copy-URL to Share ([#256](https://github.com/aboydnw/cng-sandbox/issues/256)) ([ba58ef3](https://github.com/aboydnw/cng-sandbox/commit/ba58ef325d250bc0173f1a144ceabc4194fcc98f))

## [1.20.0](https://github.com/aboydnw/cng-sandbox/compare/v1.19.0...v1.20.0) (2026-04-18)


### Features

* **frontend:** client rendering in story reader and editor ([#252](https://github.com/aboydnw/cng-sandbox/issues/252)) ([e10badb](https://github.com/aboydnw/cng-sandbox/commit/e10badb6aee48eb848fe86bfe1c438428cab8215))
* **frontend:** source.coop-styled /discover catalog demo ([#248](https://github.com/aboydnw/cng-sandbox/issues/248)) ([e966506](https://github.com/aboydnw/cng-sandbox/commit/e9665065731b50a50b12553e68c48b50859e782e))
* register VIDA Global Buildings as pmtiles example dataset ([#202](https://github.com/aboydnw/cng-sandbox/issues/202)) ([#251](https://github.com/aboydnw/cng-sandbox/issues/251)) ([221c009](https://github.com/aboydnw/cng-sandbox/commit/221c0092f062dabbbe9e1c1d79b00f2ad577f0f8))


### Bug Fixes

* **caddy:** security headers + cacheable tile responses ([#232](https://github.com/aboydnw/cng-sandbox/issues/232) follow-up) ([#246](https://github.com/aboydnw/cng-sandbox/issues/246)) ([fedacac](https://github.com/aboydnw/cng-sandbox/commit/fedacaca35b15c716cb8ea0e516b0c4b979c04be))
* **frontend:** tighten COG reprojection mesh at low zoom ([#245](https://github.com/aboydnw/cng-sandbox/issues/245)) ([61aef44](https://github.com/aboydnw/cng-sandbox/commit/61aef445a01cf1c7169e2dfa993b94ffe686ecc7))
* **ingestion:** register full GHRSST temporal range ([#198](https://github.com/aboydnw/cng-sandbox/issues/198)) ([#249](https://github.com/aboydnw/cng-sandbox/issues/249)) ([8088de8](https://github.com/aboydnw/cng-sandbox/commit/8088de856ff32e4f51837e312a7851aa52e3bd51))
* **mcp:** correct response unwrap + forward workspace header ([#250](https://github.com/aboydnw/cng-sandbox/issues/250)) ([bdadbe6](https://github.com/aboydnw/cng-sandbox/commit/bdadbe6778e50b435f784180339a729ef16c3751))

## [1.19.0](https://github.com/aboydnw/cng-sandbox/compare/v1.18.0...v1.19.0) (2026-04-17)


### Features

* editable dataset title, categorical mark, per-category colors ([#234](https://github.com/aboydnw/cng-sandbox/issues/234)) ([d74b894](https://github.com/aboydnw/cng-sandbox/commit/d74b89472cded726bc7e1b43c27ed5816fd86911))
* **frontend:** add client render path for COG connections ([#238](https://github.com/aboydnw/cng-sandbox/issues/238)) ([f8c3e83](https://github.com/aboydnw/cng-sandbox/commit/f8c3e83f288edcc5cabc43ac937dd90352843102))
* **frontend:** categorical pixel inspector ([#240](https://github.com/aboydnw/cng-sandbox/issues/240)) ([b7a2108](https://github.com/aboydnw/cng-sandbox/commit/b7a210899a375879cdeb58a41366f6e7eda175b3))
* **frontend:** default to client render mode when available ([#242](https://github.com/aboydnw/cng-sandbox/issues/242)) ([7fd74d7](https://github.com/aboydnw/cng-sandbox/commit/7fd74d712878729315c91d3ae416edebb4e64c4b))
* **frontend:** scale client-side COG render via dtype-aware dispatch ([#233](https://github.com/aboydnw/cng-sandbox/issues/233)) ([6560442](https://github.com/aboydnw/cng-sandbox/commit/6560442433bd97c39995ee426f78c0da0f8051cb))
* **frontend:** snap map as PNG on shared view ([#239](https://github.com/aboydnw/cng-sandbox/issues/239)) ([4fdfad9](https://github.com/aboydnw/cng-sandbox/commit/4fdfad98d46a2c59de484dabbcd26a0dce6cee23))


### Bug Fixes

* **ingestion:** add GDAL R2 endpoint env vars ([#244](https://github.com/aboydnw/cng-sandbox/issues/244)) ([547c515](https://github.com/aboydnw/cng-sandbox/commit/547c515f262fad1494d7c9dd079878fe20220937))
* **security:** close public-share blockers from PR [#230](https://github.com/aboydnw/cng-sandbox/issues/230) audit ([#237](https://github.com/aboydnw/cng-sandbox/issues/237)) ([b7532df](https://github.com/aboydnw/cng-sandbox/commit/b7532df9b913cd0f3af65643363e627075922ce4))
* support uint32 rasters in client render and mark-categorical ([#243](https://github.com/aboydnw/cng-sandbox/issues/243)) ([61608d4](https://github.com/aboydnw/cng-sandbox/commit/61608d445fb2bd2988703f0c6bcb0329abcdb697))

## [1.18.0](https://github.com/aboydnw/cng-sandbox/compare/v1.17.0...v1.18.0) (2026-04-16)


### Features

* **frontend:** auto-dispatch GeoParquet to client or server render (Ticket C) ([#228](https://github.com/aboydnw/cng-sandbox/issues/228)) ([3f7f1c6](https://github.com/aboydnw/cng-sandbox/commit/3f7f1c679bb3013e52f0af77b4f754b18a878dcb))
* **frontend:** render remote GeoParquet via DuckDB WASM (Ticket A) ([#225](https://github.com/aboydnw/cng-sandbox/issues/225)) ([c937ce2](https://github.com/aboydnw/cng-sandbox/commit/c937ce28d46255fc60fd3db4907939f913d5a978))
* **mcp:** MCP server for agent-driven story creation ([#221](https://github.com/aboydnw/cng-sandbox/issues/221)) ([#223](https://github.com/aboydnw/cng-sandbox/issues/223)) ([d7df2fb](https://github.com/aboydnw/cng-sandbox/commit/d7df2fb7ec8b601bd11c8a11bc223f38cf702454))
* open shared map/story views to the public ([#230](https://github.com/aboydnw/cng-sandbox/issues/230)) ([24d96a0](https://github.com/aboydnw/cng-sandbox/commit/24d96a06025bbeedc26909635602a6ed86be77bb))
* server-side GeoParquet → PMTiles pipeline (Ticket B) ([#227](https://github.com/aboydnw/cng-sandbox/issues/227)) ([5c51367](https://github.com/aboydnw/cng-sandbox/commit/5c513673dfc15dd3e59966625e04fef42c80a8b2))
* validate remote GeoParquet URLs before connecting ([#222](https://github.com/aboydnw/cng-sandbox/issues/222)) ([8fb1c63](https://github.com/aboydnw/cng-sandbox/commit/8fb1c633248059a677414d84b0bdfbeb3a11527b))


### Bug Fixes

* **frontend:** GeoParquet validation against remote URLs ([#229](https://github.com/aboydnw/cng-sandbox/issues/229)) ([aae3a01](https://github.com/aboydnw/cng-sandbox/commit/aae3a014aa7a0aaec41d5ce45d3d3a1fad16733b))
* **ingestion:** migrate `connections` columns added by server-side GeoParquet work ([#231](https://github.com/aboydnw/cng-sandbox/issues/231)) ([f731315](https://github.com/aboydnw/cng-sandbox/commit/f7313155ff4177e5949e7b0b5d1e85f2ebea6035))

## [1.17.0](https://github.com/aboydnw/cng-sandbox/compare/v1.16.0...v1.17.0) (2026-04-14)


### Features

* **frontend:** tighten story editor header for narrow widths ([#215](https://github.com/aboydnw/cng-sandbox/issues/215)) ([a8f3b22](https://github.com/aboydnw/cng-sandbox/commit/a8f3b2241d55d2697e84179d8c0bd39acc2a5a7f))


### Bug Fixes

* include uint32/int32 in categorical heuristic dtypes ([#213](https://github.com/aboydnw/cng-sandbox/issues/213)) ([169997b](https://github.com/aboydnw/cng-sandbox/commit/169997b2ae6e384fcc8ce708f7e2eb389e7f5fd7))

## [1.16.0](https://github.com/aboydnw/cng-sandbox/compare/v1.15.1...v1.16.0) (2026-04-14)


### Features

* add About page ([#190](https://github.com/aboydnw/cng-sandbox/issues/190)) ([d48f2b0](https://github.com/aboydnw/cng-sandbox/commit/d48f2b034605adad6969e2b52552906b990fc587))
* add categorical raster support ([#188](https://github.com/aboydnw/cng-sandbox/issues/188)) ([7898d6b](https://github.com/aboydnw/cng-sandbox/commit/7898d6b7268b6f9d1f3da024e1a88c71277fa415))
* connect curated source.coop directories ([#183](https://github.com/aboydnw/cng-sandbox/issues/183)) ([7812c67](https://github.com/aboydnw/cng-sandbox/commit/7812c677c1c7a53ac65158e8a68a75e1b2d701cc))
* extend categorical support to COG connections ([#206](https://github.com/aboydnw/cng-sandbox/issues/206)) ([a649c91](https://github.com/aboydnw/cng-sandbox/commit/a649c9116563dce9ebf093918a9844d37b11a131))
* **frontend:** add Dataset/Min/Max labels and section dividers to map sidebar ([#211](https://github.com/aboydnw/cng-sandbox/issues/211)) ([f374e2f](https://github.com/aboydnw/cng-sandbox/commit/f374e2ffaa58d4734071277321295fdafad1cf4b))
* **frontend:** adjustable rescale and reversible colormap ([#204](https://github.com/aboydnw/cng-sandbox/issues/204)) ([54d3831](https://github.com/aboydnw/cng-sandbox/commit/54d3831cb63d07470b9c74d10c754a72ef6d4075))
* retry example dataset registration on transient startup failures ([#205](https://github.com/aboydnw/cng-sandbox/issues/205)) ([2881d7a](https://github.com/aboydnw/cng-sandbox/commit/2881d7ae8f4eee5f703610056d36df2ab75cc082))
* sharing datasets and stories via clean URLs ([#189](https://github.com/aboydnw/cng-sandbox/issues/189)) ([aba1ff7](https://github.com/aboydnw/cng-sandbox/commit/aba1ff7fc4d7849616b33cc0e0a3e9c669b4068c))
* source.coop as shared example datasets ([#203](https://github.com/aboydnw/cng-sandbox/issues/203)) ([d2b8886](https://github.com/aboydnw/cng-sandbox/commit/d2b8886b593b0f5bc7561ffc0b1e2be970b827b2))


### Bug Fixes

* About page styling and routing improvements ([#191](https://github.com/aboydnw/cng-sandbox/issues/191)) ([37211a4](https://github.com/aboydnw/cng-sandbox/commit/37211a47a5d5c1bf860d09ef821a03add28680cf))
* apply scale/offset when computing remote raster stats ([#193](https://github.com/aboydnw/cng-sandbox/issues/193)) ([7f44e1a](https://github.com/aboydnw/cng-sandbox/commit/7f44e1a12643cc45f815103cd45730642d7ddf4b))
* avoid full-res read in categorical color table detection ([#209](https://github.com/aboydnw/cng-sandbox/issues/209)) ([b4c4c7c](https://github.com/aboydnw/cng-sandbox/commit/b4c4c7c9c499deafccf10d605824de081dca328f))
* bump frontend dev container memory limit to 2G ([#207](https://github.com/aboydnw/cng-sandbox/issues/207)) ([b33e5d6](https://github.com/aboydnw/cng-sandbox/commit/b33e5d63b8d175bfba28ac02d34278b1748c3b36))
* close SSRF holes and enforce access control ([#195](https://github.com/aboydnw/cng-sandbox/issues/195)) ([8fe62b8](https://github.com/aboydnw/cng-sandbox/commit/8fe62b8e690d143c18fa90f3004025f999144c26))
* compute rescale stats for source.coop datasets ([#192](https://github.com/aboydnw/cng-sandbox/issues/192)) ([653da17](https://github.com/aboydnw/cng-sandbox/commit/653da1740e657ef396d012bee43de227ff691922))
* force deck.gl tile refresh on temporal browse navigation ([#196](https://github.com/aboydnw/cng-sandbox/issues/196)) ([973a744](https://github.com/aboydnw/cng-sandbox/commit/973a744c8d0f88a0ba7fc8dc8e09a6b44fb374b1))
* pin Land & Carbon Lab example to single emissions raster ([#212](https://github.com/aboydnw/cng-sandbox/issues/212)) ([7a0a938](https://github.com/aboydnw/cng-sandbox/commit/7a0a938d59e2ecf9424164befe114a374604fb01))
* prevent ingestion OOM during tif conversion ([#210](https://github.com/aboydnw/cng-sandbox/issues/210)) ([14fdde3](https://github.com/aboydnw/cng-sandbox/commit/14fdde397198e25c3da1173aed0446263d93921b)), closes [#208](https://github.com/aboydnw/cng-sandbox/issues/208)
* URL-encode temporal datetime in tile URLs ([#186](https://github.com/aboydnw/cng-sandbox/issues/186)) ([d2a07d1](https://github.com/aboydnw/cng-sandbox/commit/d2a07d17ab40c93739c4eda34869074a0f99f8eb))
* use raw pixel values for rescale stats, not scaled values ([#194](https://github.com/aboydnw/cng-sandbox/issues/194)) ([84d9eb0](https://github.com/aboydnw/cng-sandbox/commit/84d9eb04c4be391656e5cf011dd0e9e2a0986891))

## [1.15.1](https://github.com/aboydnw/cng-sandbox/compare/v1.15.0...v1.15.1) (2026-04-10)


### Bug Fixes

* accept zipped shapefiles with multiple .shp layers ([#181](https://github.com/aboydnw/cng-sandbox/issues/181)) ([d632d60](https://github.com/aboydnw/cng-sandbox/commit/d632d6089e4eda21b9d36d03ae5b7ac9112640e3)), closes [#180](https://github.com/aboydnw/cng-sandbox/issues/180)

## [1.15.0](https://github.com/aboydnw/cng-sandbox/compare/v1.14.2...v1.15.0) (2026-04-10)


### Features

* add descriptive error messages for uploads and connections ([#169](https://github.com/aboydnw/cng-sandbox/issues/169)) ([7935802](https://github.com/aboydnw/cng-sandbox/commit/793580282c14a1fc89284e9890c2779cde3c31de))


### Bug Fixes

* fully reset job state when starting or retrying an upload ([#179](https://github.com/aboydnw/cng-sandbox/issues/179)) ([978d3ee](https://github.com/aboydnw/cng-sandbox/commit/978d3eea03dab79675553f95c8627763a575bc0e)), closes [#175](https://github.com/aboydnw/cng-sandbox/issues/175)
* make overview level check adaptive to raster dimensions ([#176](https://github.com/aboydnw/cng-sandbox/issues/176)) ([9dd5592](https://github.com/aboydnw/cng-sandbox/commit/9dd559225976c44e815830b0e08e417c433ef2f4)), closes [#174](https://github.com/aboydnw/cng-sandbox/issues/174)
* stop parsing truncated vector files in pre-upload format check ([#173](https://github.com/aboydnw/cng-sandbox/issues/173)) ([bdd6623](https://github.com/aboydnw/cng-sandbox/commit/bdd66233019919183e803682836693ad7db15c6f))
* use 95th percentile instead of max for reprojected pixel fidelity ([#178](https://github.com/aboydnw/cng-sandbox/issues/178)) ([f8be1f9](https://github.com/aboydnw/cng-sandbox/commit/f8be1f96c3d15968278dcce15b670cfba2ceae19)), closes [#177](https://github.com/aboydnw/cng-sandbox/issues/177)

## [1.14.2](https://github.com/aboydnw/cng-sandbox/compare/v1.14.1...v1.14.2) (2026-04-08)


### Bug Fixes

* exempt /api/health from basic auth so uptime monitor works ([#164](https://github.com/aboydnw/cng-sandbox/issues/164)) ([2d00c50](https://github.com/aboydnw/cng-sandbox/commit/2d00c504a1657b1d838d929fdba35d91242e888b)), closes [#155](https://github.com/aboydnw/cng-sandbox/issues/155)
* library page empty on refresh due to workspace ID race condition ([#163](https://github.com/aboydnw/cng-sandbox/issues/163)) ([0bb2b61](https://github.com/aboydnw/cng-sandbox/commit/0bb2b61f23b21240d017dca339133aea2e858237)), closes [#160](https://github.com/aboydnw/cng-sandbox/issues/160)

## [1.14.1](https://github.com/aboydnw/cng-sandbox/compare/v1.14.0...v1.14.1) (2026-04-08)


### Bug Fixes

* stop stripping /cog prefix from COG tiler proxy ([#159](https://github.com/aboydnw/cng-sandbox/issues/159)) ([60d26be](https://github.com/aboydnw/cng-sandbox/commit/60d26be4fc55abc45b4aed8023e1315a4c8d42ae))

## [1.14.0](https://github.com/aboydnw/cng-sandbox/compare/v1.13.2...v1.14.0) (2026-04-08)


### Features

* accept .h5 and .hdf5 in file uploader ([9d43840](https://github.com/aboydnw/cng-sandbox/commit/9d438408c3c3eaf0ee54612e2b1720602a8bd01a))
* accept job_id as bug report context for upload errors ([0f48a54](https://github.com/aboydnw/cng-sandbox/commit/0f48a54bf45d97e351b19d72a696ed89288f56e5))
* add /story/:id/embed route for iframe embedding ([cebd19b](https://github.com/aboydnw/cng-sandbox/commit/cebd19baf6e6d6619e3864c4806c0f3a7602dfa6))
* add agentic development pipeline ([#53](https://github.com/aboydnw/cng-sandbox/issues/53)) ([4b49bd3](https://github.com/aboydnw/cng-sandbox/commit/4b49bd37152eaba16cdba7d1abc40c075d359bb4))
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
* add connection report card drawer with stepped content ([#149](https://github.com/aboydnw/cng-sandbox/issues/149)) ([42be995](https://github.com/aboydnw/cng-sandbox/commit/42be995998aa17657d59f3261361c4bef6b1184a))
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
* add per-stage progress indicators to upload workflow ([#85](https://github.com/aboydnw/cng-sandbox/issues/85)) ([3cbd8ef](https://github.com/aboydnw/cng-sandbox/commit/3cbd8efe20674d03eac7cdd24c2bd2978946909a))
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
* add workspace-based data isolation ([#26](https://github.com/aboydnw/cng-sandbox/issues/26)) ([c776754](https://github.com/aboydnw/cng-sandbox/commit/c77675485bed79ec0e67be89e659baf48111e438))
* allow creating stories without a dataset from the homepage ([aa46200](https://github.com/aboydnw/cng-sandbox/commit/aa46200060c9b084c62b57935de643f68bd51b96))
* catch duplicate dataset uploads ([#140](https://github.com/aboydnw/cng-sandbox/issues/140)) ([3c4cd19](https://github.com/aboydnw/cng-sandbox/commit/3c4cd199a096c53701ef55820ad41c20f0a0f50d))
* cloud-optimized data connections ([#67](https://github.com/aboydnw/cng-sandbox/issues/67)) ([a4ac6f1](https://github.com/aboydnw/cng-sandbox/commit/a4ac6f1eacdf2de072755332618bbe63d41454e7))
* combine datasets and stories into Library page ([#35](https://github.com/aboydnw/cng-sandbox/issues/35)) ([103f638](https://github.com/aboydnw/cng-sandbox/commit/103f638e025dffaec0c82780b348eff1b05c44e6))
* conditionally show map preview based on chapter type ([957358b](https://github.com/aboydnw/cng-sandbox/commit/957358b2615ffbbc6b1ed5f5a923ae4d00cd3ca3))
* details drawer redesign with interactive pipeline timeline ([#24](https://github.com/aboydnw/cng-sandbox/issues/24)) ([f3eb798](https://github.com/aboydnw/cng-sandbox/commit/f3eb798781d3b176e49fa9c9f4e4db986b4d40f7))
* disable client-side rendering for COGs over 200 MB ([#84](https://github.com/aboydnw/cng-sandbox/issues/84)) ([ab5fd74](https://github.com/aboydnw/cng-sandbox/commit/ab5fd74238aed92349e5180ddf02afb525b7a55b))
* editor supports per-chapter dataset selection ([34c0d69](https://github.com/aboydnw/cng-sandbox/commit/34c0d696ca9c84b92bce9f9be37f2d93efc262f3))
* emit scan_result SSE event for variable selection ([6211ed7](https://github.com/aboydnw/cng-sandbox/commit/6211ed7cc5205285ad38cb8a821432b0785d58db))
* extend UnifiedMap with optional fly-to transition support ([42cac5a](https://github.com/aboydnw/cng-sandbox/commit/42cac5a9ed7125d2205320d5cb9bb012554f8cd9))
* extract COG client-side layer builder from DirectRasterMap ([37a1dd4](https://github.com/aboydnw/cng-sandbox/commit/37a1dd4334caed727db47ddf3118ce2d2458f3b6))
* extract GeoJSON layer builder from DuckDBMap ([d61bb84](https://github.com/aboydnw/cng-sandbox/commit/d61bb8417a3d546ef87926c34d1c6d30ec4bd245))
* extract PixelInspector overlay from DirectRasterMap ([050352f](https://github.com/aboydnw/cng-sandbox/commit/050352f36eb07ef87e76d61f6bb92f43c7066360))
* extract raster tile layer builder from RasterMap ([7e07545](https://github.com/aboydnw/cng-sandbox/commit/7e07545d3c4aca122374d6359e01aa2c6ad6afdd))
* extract RasterControls overlay from RasterMap ([280d455](https://github.com/aboydnw/cng-sandbox/commit/280d455616e28791d50ae24c1f64e93dde5f2c2a))
* extract shared SQLAlchemy Base to models/base.py ([d9f4a2f](https://github.com/aboydnw/cng-sandbox/commit/d9f4a2ff588649fb6c7075ce0817adaa88afe43a))
* geostationary satellite reprojection for NetCDF conversion ([#60](https://github.com/aboydnw/cng-sandbox/issues/60)) ([251f977](https://github.com/aboydnw/cng-sandbox/commit/251f977cb6382f0a37560d409fedd4671fbe58af))
* handle scan_result SSE and add confirmVariable to upload hook ([82548e7](https://github.com/aboydnw/cng-sandbox/commit/82548e7c7e3fb273d627acf2f390020a889a75f5))
* HDF5 file upload with variable selection ([d9333a0](https://github.com/aboydnw/cng-sandbox/commit/d9333a0bc9ee5222856899514b7a6a934e4c70eb))
* improve guided tour with overlay layout and fly-to fix ([#120](https://github.com/aboydnw/cng-sandbox/issues/120)) ([6e1e47c](https://github.com/aboydnw/cng-sandbox/commit/6e1e47c14215464c3989f5c517077025f61f82af))
* improve homepage cards with descriptive content and story expansion ([#43](https://github.com/aboydnw/cng-sandbox/issues/43)) ([2907caf](https://github.com/aboydnw/cng-sandbox/commit/2907caf547916febd8ef4bd811f813f2220142e4))
* in-file temporal extraction for NetCDF and HDF5 ([#99](https://github.com/aboydnw/cng-sandbox/issues/99)) ([1e33653](https://github.com/aboydnw/cng-sandbox/commit/1e33653e7a80593ddc8a1927edfbcc0382d6e9bd))
* initialize CNG Sandbox as standalone repo ([fe4468d](https://github.com/aboydnw/cng-sandbox/commit/fe4468d7e11dbbdc31687a38a65d6ad4be4ffb16))
* initialize stories table on app startup ([a963bab](https://github.com/aboydnw/cng-sandbox/commit/a963babfe3631aaa9e9c720a2f07fae596ce3d45))
* make dataset_id optional for story creation ([9d3d50c](https://github.com/aboydnw/cng-sandbox/commit/9d3d50c354d77a7cfe8856052a17bab0e1225334))
* make dataset_id optional in frontend story types and helpers ([c664a17](https://github.com/aboydnw/cng-sandbox/commit/c664a17e31a35f26d6cbadcb7ededac0c0de9b21))
* make header logo a clickable home link ([cd9acda](https://github.com/aboydnw/cng-sandbox/commit/cd9acda0b419cf47e8549ef6481ace9c96272a9f))
* map zooms to data bounds in story editor ([#69](https://github.com/aboydnw/cng-sandbox/issues/69)) ([2cf151a](https://github.com/aboydnw/cng-sandbox/commit/2cf151a57695d8c4bc062eb1d3efbfbca24d5bbc))
* migrate chapters without type to scrollytelling ([14b19c2](https://github.com/aboydnw/cng-sandbox/commit/14b19c2b7266c18ac172f04c8ffd5b9c859c661d))
* migrate story editor from localStorage to API persistence ([e81ba2b](https://github.com/aboydnw/cng-sandbox/commit/e81ba2ba2b2c8ad98b830a09719404cc03e8dd02))
* migrate story reader from localStorage to API persistence ([186ae4f](https://github.com/aboydnw/cng-sandbox/commit/186ae4f5821ac833af11a9231c32d884eb33c5cd))
* persist datasets to PostgreSQL via pipeline ([8ec5c5b](https://github.com/aboydnw/cng-sandbox/commit/8ec5c5b04df47ab41f9cc9d5e511e2367fc16b7f))
* **pixel-inspector:** add floating tooltip UI ([2a80d9c](https://github.com/aboydnw/cng-sandbox/commit/2a80d9c8d7fb1fe6da18e4e2189ec34d66d032c2))
* **pixel-inspector:** add hover handler with coordinate lookup ([bbfd1af](https://github.com/aboydnw/cng-sandbox/commit/bbfd1af2d762a254c6c705e28c0b8c7d16e184b0))
* **pixel-inspector:** add tile data cache in getTileData ([aa29e32](https://github.com/aboydnw/cng-sandbox/commit/aa29e323db9a9c9b37a28c90271a0e9e7c5896e2))
* populate cog_url for raster datasets in pipeline ([8edc0ae](https://github.com/aboydnw/cng-sandbox/commit/8edc0aea51bc7ba91b6267c372c9c0292d577751))
* preflight duplicate check before upload ([#142](https://github.com/aboydnw/cng-sandbox/issues/142)) ([2b0a6b1](https://github.com/aboydnw/cng-sandbox/commit/2b0a6b1c10fb8c744d30b1b3e1865c23919b4227))
* production stability improvements ([63a09a2](https://github.com/aboydnw/cng-sandbox/commit/63a09a2b453d537dfcc3a0864e3a8caad805c818))
* reader supports multi-dataset stories with graceful degradation ([50074d1](https://github.com/aboydnw/cng-sandbox/commit/50074d10fe1f05314e066fd5f967f0892affc18c))
* reader uses per-chapter LayerConfig for styling ([00e4837](https://github.com/aboydnw/cng-sandbox/commit/00e4837e7da99078d0af2b8c56e1f58d8cb6bfc5))
* redesign homepage with three equal-weight cards ([#80](https://github.com/aboydnw/cng-sandbox/issues/80)) ([9bb65d2](https://github.com/aboydnw/cng-sandbox/commit/9bb65d2ee693d40b6e8b302a3b818462e793799c))
* remote data connection with mosaic and temporal ingestion ([#119](https://github.com/aboydnw/cng-sandbox/issues/119)) ([30fc497](https://github.com/aboydnw/cng-sandbox/commit/30fc497ad0b337aa4225c9cd5b1be8ce7f625c5e))
* render chapters by type — prose, map, scrollytelling ([7119bab](https://github.com/aboydnw/cng-sandbox/commit/7119bab46c07146d65fa5a0b92d609bc0b22b0fe))
* replace boto3 with obstore for S3/R2 object storage ([#71](https://github.com/aboydnw/cng-sandbox/issues/71)) ([ec86916](https://github.com/aboydnw/cng-sandbox/commit/ec86916d80a629a5507252f5b20bbf1c62293862))
* restructure MapPage with new SidePanel and renderMode ([02ee3b1](https://github.com/aboydnw/cng-sandbox/commit/02ee3b16d31ef3dc2dafd3ba4d120834ad234142))
* rework ReportCard into tech deep dive panel ([65e23d1](https://github.com/aboydnw/cng-sandbox/commit/65e23d1034699de9cb2bd35d77d07c85a7a7bca4))
* rewrite dataset endpoints to read from PostgreSQL ([d67003e](https://github.com/aboydnw/cng-sandbox/commit/d67003eb05a25bf141cd9be9766a5360a96c5beb))
* rewrite homepage with two-card layout and inline upload flow ([f59a912](https://github.com/aboydnw/cng-sandbox/commit/f59a912c3a5d2f20ce6c62bb504563ec7d89cfca))
* rewrite stac_ingest with rio-stac and pystac ([9ccfa08](https://github.com/aboydnw/cng-sandbox/commit/9ccfa08923ca039874a9b3bcc7550bbe6607e83a))
* serve production frontend as static files via Caddy ([#10](https://github.com/aboydnw/cng-sandbox/issues/10)) ([8025ac1](https://github.com/aboydnw/cng-sandbox/commit/8025ac1a6fe55e47791a0d7e2c954594d9585a80))
* share button with clipboard copy animation and render-mode-aware details ([714adf1](https://github.com/aboydnw/cng-sandbox/commit/714adf1d086c66afea5344689518f8e88fd8d470))
* show chapter type indicator in sidebar ([e7cadd4](https://github.com/aboydnw/cng-sandbox/commit/e7cadd421e8c11d05a39247270bd5b7155aef0ef))
* show VariablePicker in upload flow for HDF5/NetCDF files ([a4136fd](https://github.com/aboydnw/cng-sandbox/commit/a4136fde9edbd98d2ac3df7c965d9195de8d6854))
* show warning when connection probe fails ([#146](https://github.com/aboydnw/cng-sandbox/issues/146)) ([8d66a7f](https://github.com/aboydnw/cng-sandbox/commit/8d66a7f81f075ff7fec0e688d4a9a4f56eb9dcb5))
* story editor panel redesign ([#134](https://github.com/aboydnw/cng-sandbox/issues/134)) ([cb2e7df](https://github.com/aboydnw/cng-sandbox/commit/cb2e7dfc087f69d3c9a56fae9fe24be4252f7b3c))
* story editor UX overhaul ([#27](https://github.com/aboydnw/cng-sandbox/issues/27)) ([bf1f9f2](https://github.com/aboydnw/cng-sandbox/commit/bf1f9f2d8dc59c43a00edf94e56c9dafe08b25ed))
* switch datasets and connections from map page ([#70](https://github.com/aboydnw/cng-sandbox/issues/70)) ([6baacbf](https://github.com/aboydnw/cng-sandbox/commit/6baacbf7926228876162527be5ef376035d86fd8))
* temporal browsing and story integration ([#129](https://github.com/aboydnw/cng-sandbox/issues/129)) ([4d48388](https://github.com/aboydnw/cng-sandbox/commit/4d483886b0eac92fedfa0e76f0f7a2e2fd606c67))
* unify map sidebar between datasets and connections ([#148](https://github.com/aboydnw/cng-sandbox/issues/148)) ([e5775eb](https://github.com/aboydnw/cng-sandbox/commit/e5775eb6f9bc2609c24765c284e0f8cab1954a11))
* universal CRS reprojection for all raster formats ([#81](https://github.com/aboydnw/cng-sandbox/issues/81)) ([35011b4](https://github.com/aboydnw/cng-sandbox/commit/35011b45e31c21db4f918426daf6d998b32b91a5))
* wire bug report link into map and story pages ([f031c8e](https://github.com/aboydnw/cng-sandbox/commit/f031c8e217339ce4148acce79fcf5294de93afc1))
* wire CreditsPanel story CTA to internal editor route ([fb7dd8e](https://github.com/aboydnw/cng-sandbox/commit/fb7dd8eb9c3283367a5ef523cf6219b94b30a98a))
* wire HDF5 converter into pipeline with variable/group forwarding ([fd11de3](https://github.com/aboydnw/cng-sandbox/commit/fd11de3fb38da3009705ef21e3a8bc434d32a984))


### Bug Fixes

* add cache-control headers to prevent stale assets after deploy ([#102](https://github.com/aboydnw/cng-sandbox/issues/102)) ([e611bf6](https://github.com/aboydnw/cng-sandbox/commit/e611bf64824d453946c4665cd6db842f01f7e7a3))
* add colormap_name to raster tile URLs in story pages ([d1350f2](https://github.com/aboydnw/cng-sandbox/commit/d1350f2242e52e6b96ea7cc199722075686b47bc))
* add crypto.randomUUID fallback for non-secure contexts ([e3806e3](https://github.com/aboydnw/cng-sandbox/commit/e3806e349e8900ac6c3af5c6d89bf06190e3eeb9))
* add item ID to bounds-zoom dependency ([56f23f6](https://github.com/aboydnw/cng-sandbox/commit/56f23f6c27ab55390f66ab4dc4b45e8c935e71b6))
* add missing uri strip_prefix for COG tiler proxy ([#112](https://github.com/aboydnw/cng-sandbox/issues/112)) ([ef53ea1](https://github.com/aboydnw/cng-sandbox/commit/ef53ea138cfe63522458fd0b55b2da22287a471f)), closes [#111](https://github.com/aboydnw/cng-sandbox/issues/111)
* add name to uptime workflow to prevent spurious push failures ([#150](https://github.com/aboydnw/cng-sandbox/issues/150)) ([4120f52](https://github.com/aboydnw/cng-sandbox/commit/4120f528fe8cf0c83397313bb17e9c065b5c8e09))
* add release-please config and manifest for proper version tracking ([45536e4](https://github.com/aboydnw/cng-sandbox/commit/45536e4035025f0e4a60af3cbbb4f5c3b1b650eb))
* add rescale to story tile URLs and fix editor map interaction ([d3556e5](https://github.com/aboydnw/cng-sandbox/commit/d3556e5e32cc393d7f22292e8c5d57362dc86286))
* add upload size limit and timeouts to Caddy proxy ([#86](https://github.com/aboydnw/cng-sandbox/issues/86)) ([3521fd7](https://github.com/aboydnw/cng-sandbox/commit/3521fd7ebaa010a46d3f8ae2f3f4c1e877d7da38))
* add vector view mode toggle for PMTiles vs GeoParquet ([#39](https://github.com/aboydnw/cng-sandbox/issues/39)) ([34fb9aa](https://github.com/aboydnw/cng-sandbox/commit/34fb9aaa3c912e98888ec3d964648741c56dc145)), closes [#22](https://github.com/aboydnw/cng-sandbox/issues/22)
* address code review — add id param, rename onViewportLoad to getLoadCallback ([da902c1](https://github.com/aboydnw/cng-sandbox/commit/da902c108c3082e70e7d8af6245f166329236508))
* address code review findings for bug report feature ([6ac78e1](https://github.com/aboydnw/cng-sandbox/commit/6ac78e149b42d3401a11baf835ac70843bedb02f))
* address code review findings for multi-dataset stories ([6371522](https://github.com/aboydnw/cng-sandbox/commit/6371522e6c8d4809633c9d73d5d44558cbc57761))
* address code review issues in HDF5 feature ([9939460](https://github.com/aboydnw/cng-sandbox/commit/99394601a02efe08a7866864657f4fd4e5d8bb6b))
* address CodeRabbit review feedback ([86984d5](https://github.com/aboydnw/cng-sandbox/commit/86984d523c06b264aa1297c036d5358d88caebd4))
* align sidebar and deep dive styling with site design language ([9f57415](https://github.com/aboydnw/cng-sandbox/commit/9f5741523593039682bf30ec842e6b871f898a7a))
* calendar popover styling and clickability ([#133](https://github.com/aboydnw/cng-sandbox/issues/133)) ([f638b39](https://github.com/aboydnw/cng-sandbox/commit/f638b39929f7f54935cb635664806daf4a593ae1))
* center homepage subtitle text ([#14](https://github.com/aboydnw/cng-sandbox/issues/14)) ([a572432](https://github.com/aboydnw/cng-sandbox/commit/a57243223d6c1ebe1f4a5e7d133783279e0eb978))
* **ci:** switch frontend to npm and add pystac validation dep ([139309d](https://github.com/aboydnw/cng-sandbox/commit/139309d32e9b7b97182c8c8581b6badb6ad91803))
* consolidate colormap definitions and lowercase keys for titiler compatibility ([#59](https://github.com/aboydnw/cng-sandbox/issues/59)) ([97f57ec](https://github.com/aboydnw/cng-sandbox/commit/97f57ec567ade799c8204a16d7459424ef863aac))
* disable map interaction in scrollytelling chapters ([a3a32e9](https://github.com/aboydnw/cng-sandbox/commit/a3a32e9bea95825ad6524675b7b487ac5d8aac53))
* DRY vector layer config, add optional id param ([d5cad4b](https://github.com/aboydnw/cng-sandbox/commit/d5cad4b66d408faead28b00fffceea3d258badd3))
* enable deck.gl controller for transitions in non-interactive maps ([#124](https://github.com/aboydnw/cng-sandbox/issues/124)) ([eef4c5c](https://github.com/aboydnw/cng-sandbox/commit/eef4c5c8de94de285c480edbc7272d084d895253))
* enable deck.gl controller for transitions in non-interactive maps ([#128](https://github.com/aboydnw/cng-sandbox/issues/128)) ([e43e752](https://github.com/aboydnw/cng-sandbox/commit/e43e752a7a3b19f920567fe236262a9bbfc2ab8a))
* ensure fresh frontend assets on every deploy ([#78](https://github.com/aboydnw/cng-sandbox/issues/78)) ([a8dc212](https://github.com/aboydnw/cng-sandbox/commit/a8dc212dcfb9588425fc7f6de21f10c3e556ac1d))
* extract CRS name from WKT instead of missing .name attribute ([#34](https://github.com/aboydnw/cng-sandbox/issues/34)) ([fec81f6](https://github.com/aboydnw/cng-sandbox/commit/fec81f6186a474698e87376f5eb8180e209ee207)), closes [#33](https://github.com/aboydnw/cng-sandbox/issues/33)
* feed intermediate camera frames back to deck.gl during fly-to ([#125](https://github.com/aboydnw/cng-sandbox/issues/125)) ([6d18edf](https://github.com/aboydnw/cng-sandbox/commit/6d18edf1d7a7a95fd56ecb94c3761d2c845820ab))
* feed intermediate camera frames back to deck.gl during fly-to ([#125](https://github.com/aboydnw/cng-sandbox/issues/125)) ([#127](https://github.com/aboydnw/cng-sandbox/issues/127)) ([03381b1](https://github.com/aboydnw/cng-sandbox/commit/03381b1813e0db5fb39aeb90cd0f226804cfd5c3))
* guard navigator.clipboard calls for non-secure contexts ([55bcf99](https://github.com/aboydnw/cng-sandbox/commit/55bcf99911202a2690147dbf6340290fd0c3c0bd))
* guided tour overlay follow-up improvements ([#122](https://github.com/aboydnw/cng-sandbox/issues/122)) ([2636fa1](https://github.com/aboydnw/cng-sandbox/commit/2636fa1bd5a625ae965343cf1f5f055af7d2f507))
* handle 3D HDF5 datasets in pixel fidelity validator ([#106](https://github.com/aboydnw/cng-sandbox/issues/106)) ([5461abb](https://github.com/aboydnw/cng-sandbox/commit/5461abb041e01818033ab99ceaa3b8620bb4dd1b))
* handle large raster files without OOM crashes ([#82](https://github.com/aboydnw/cng-sandbox/issues/82)) ([b3d9589](https://github.com/aboydnw/cng-sandbox/commit/b3d95895582ecf77e802e0cb90e733fcbd472b19))
* hide preload progress in browse mode, improve calendar pill padding ([#132](https://github.com/aboydnw/cng-sandbox/issues/132)) ([8ca796a](https://github.com/aboydnw/cng-sandbox/commit/8ca796af91612c03633fd00877ad3acb3b32b1cc))
* improve HDF5 converter robustness for NISAR data ([#40](https://github.com/aboydnw/cng-sandbox/issues/40)) ([30bd477](https://github.com/aboydnw/cng-sandbox/commit/30bd477f39c7bc807f63a32cd8278f443d577358))
* improve icon+text spacing across all frontend components ([dd34c0c](https://github.com/aboydnw/cng-sandbox/commit/dd34c0c5e5479e7b0b6342aa8e833b2d6ced23a3))
* include pipeline error message in bug reports ([#32](https://github.com/aboydnw/cng-sandbox/issues/32)) ([cbc6c0a](https://github.com/aboydnw/cng-sandbox/commit/cbc6c0aa50211a6ccec09aa8437f468920cd55ee))
* migrate from DuckDNS to custom domain and fix prod build ([#77](https://github.com/aboydnw/cng-sandbox/issues/77)) ([b18f0af](https://github.com/aboydnw/cng-sandbox/commit/b18f0afc037cb16aacd0a88c8a28e0089078cb1a))
* **pixel-inspector:** use dataset bounds for tile extent lookup ([41e0f80](https://github.com/aboydnw/cng-sandbox/commit/41e0f808d2d744d3315d5536e69ead310a3b823d))
* PMTiles connections not rendering when tile_type is null ([#143](https://github.com/aboydnw/cng-sandbox/issues/143)) ([7d5ccf3](https://github.com/aboydnw/cng-sandbox/commit/7d5ccf3037692aae9ccfbf1c621518bf7e5b9086)), closes [#139](https://github.com/aboydnw/cng-sandbox/issues/139)
* PMTiles MVTLayer integration — use loaders.gl for tile parsing ([12ba771](https://github.com/aboydnw/cng-sandbox/commit/12ba77195219fdc2e73e1e1e06a3bf565c7cb991))
* polish homepage layout — fit expanded card in viewport, make cards clickable ([738903d](https://github.com/aboydnw/cng-sandbox/commit/738903debe6392ccebf8a1461e77ef9b3083b589))
* prevent triage agent from entering plan mode ([056473c](https://github.com/aboydnw/cng-sandbox/commit/056473cf837f37d3da9907952abffc290643e032))
* progressively preload temporal timesteps instead of all at once ([#109](https://github.com/aboydnw/cng-sandbox/issues/109)) ([a28a838](https://github.com/aboydnw/cng-sandbox/commit/a28a838387a1b7d2c24f013c4ad9744f3d9153f1))
* proxy streaming response closes httpx client prematurely ([#144](https://github.com/aboydnw/cng-sandbox/issues/144)) ([3a13fa9](https://github.com/aboydnw/cng-sandbox/commit/3a13fa998f6e23868021d2f76537d1101bdd42fb))
* register hdf5_to_cog package in cng-toolkit pyproject.toml ([8c5155a](https://github.com/aboydnw/cng-sandbox/commit/8c5155a250a51fa0fd609997695682aa30872009))
* resolve PMTiles 400 errors through Caddy reverse proxy ([685b0f7](https://github.com/aboydnw/cng-sandbox/commit/685b0f7875dd7ddc4546eae9a840c7910cbf9b0c))
* resolve publish race condition and improve API error handling ([8900b5b](https://github.com/aboydnw/cng-sandbox/commit/8900b5ba6af9bb90f135dde9244607c39f74706b))
* restore Scrollama scroll-driven transitions for scrollytelling blocks ([191d164](https://github.com/aboydnw/cng-sandbox/commit/191d1640cb895930ff5c110cda7971d3cfccf8c2))
* rewrap 0-360 longitudes in NetCDF validator to match converter ([#104](https://github.com/aboydnw/cng-sandbox/issues/104)) ([84fd16f](https://github.com/aboydnw/cng-sandbox/commit/84fd16f2fc71ae468d30e9fffebaae7165e1896a)), closes [#101](https://github.com/aboydnw/cng-sandbox/issues/101)
* rewrite uptime workflow to avoid heredoc YAML parsing issue ([#152](https://github.com/aboydnw/cng-sandbox/issues/152)) ([120a8d6](https://github.com/aboydnw/cng-sandbox/commit/120a8d6aedefabd4fbcd9c0b1022c66d4bd92e72))
* scrollytelling initialization and scroll context for overlay layout ([#123](https://github.com/aboydnw/cng-sandbox/issues/123)) ([a484eac](https://github.com/aboydnw/cng-sandbox/commit/a484eac808159e9e44c4f825fb506857f0b8f1ec))
* serialize Error objects in console capture (closes [#21](https://github.com/aboydnw/cng-sandbox/issues/21)) ([#29](https://github.com/aboydnw/cng-sandbox/issues/29)) ([cbb167d](https://github.com/aboydnw/cng-sandbox/commit/cbb167d82468458bfc5a67464dab69c92509b8f4))
* simplify progress indicators to elapsed timers with context labels ([#90](https://github.com/aboydnw/cng-sandbox/issues/90)) ([1802d4f](https://github.com/aboydnw/cng-sandbox/commit/1802d4f64ba09f7cf10ad4825d45a75aa3950061))
* skip pixel fidelity check for reprojected GeoTIFFs ([#83](https://github.com/aboydnw/cng-sandbox/issues/83)) ([6a880d0](https://github.com/aboydnw/cng-sandbox/commit/6a880d0a1af5609105b0e77ab2a3f855eabb4ffb))
* stabilize fetchWithRetry network error test ([61ec897](https://github.com/aboydnw/cng-sandbox/commit/61ec89788edaf2f99b95f681f1a7ec87bb5bd209))
* story editor dropdown polish and portal pattern ([#137](https://github.com/aboydnw/cng-sandbox/issues/137)) ([82a45bf](https://github.com/aboydnw/cng-sandbox/commit/82a45bfcb26b6102e401f2561bfc81ab93b45239))
* story editor timestep selection not applied to map ([#138](https://github.com/aboydnw/cng-sandbox/issues/138)) ([9021c5b](https://github.com/aboydnw/cng-sandbox/commit/9021c5b1ef0299757e7c297d500579b1cf9430c7))
* unify side panel card designs and improve control affordances ([8e60251](https://github.com/aboydnw/cng-sandbox/commit/8e602512599a980bec9d01ae41b0305689de3d60))
* use bypassPermissions for headless triage execution ([2395b05](https://github.com/aboydnw/cng-sandbox/commit/2395b05b9c86409f73b9f3491fb266517dbb90f3))
* use cascading delete in TTL cleanup and add orphan detection script ([#92](https://github.com/aboydnw/cng-sandbox/issues/92)) ([2555d9b](https://github.com/aboydnw/cng-sandbox/commit/2555d9b8eb1d64009a175873f755e1388ab532cc))
* use controller={true} with pointer-events for fly-to transitions ([#126](https://github.com/aboydnw/cng-sandbox/issues/126)) ([b0b2227](https://github.com/aboydnw/cng-sandbox/commit/b0b222756e4b34b7765bf3b43e3fbb910f59e6ea))
* use correct claude-code-action API parameters ([#58](https://github.com/aboydnw/cng-sandbox/issues/58)) ([30da82e](https://github.com/aboydnw/cng-sandbox/commit/30da82eb044a649e14b227f3dbef8cbc95a98326))
* use ordered list for coordinate name lookup in HDF5 converter ([929b195](https://github.com/aboydnw/cng-sandbox/commit/929b19552b4c174a7ae468ce79c27207edbf3ac2))
* use ordered lists for coordinate name lookup in HDF5 validator ([6cb6134](https://github.com/aboydnw/cng-sandbox/commit/6cb6134627e15370e97755ea513d27a36c0deac4))
* use overview reads in compute_global_stats to avoid OOM ([00f9899](https://github.com/aboydnw/cng-sandbox/commit/00f989940cd7a1489e342d9a18bc0dc86867fab6))
* use string | null for cog_url type to match API response format ([7ac1c87](https://github.com/aboydnw/cng-sandbox/commit/7ac1c87f7eb977a26e2d408a72b91208fde1a738))

## [1.13.2](https://github.com/aboydnw/cng-sandbox/compare/v1.13.1...v1.13.2) (2026-04-08)


### Bug Fixes

* rewrite uptime workflow to avoid heredoc YAML parsing issue ([#152](https://github.com/aboydnw/cng-sandbox/issues/152)) ([120a8d6](https://github.com/aboydnw/cng-sandbox/commit/120a8d6aedefabd4fbcd9c0b1022c66d4bd92e72))

## [1.13.1](https://github.com/aboydnw/cng-sandbox/compare/v1.13.0...v1.13.1) (2026-04-08)


### Bug Fixes

* add name to uptime workflow to prevent spurious push failures ([#150](https://github.com/aboydnw/cng-sandbox/issues/150)) ([4120f52](https://github.com/aboydnw/cng-sandbox/commit/4120f528fe8cf0c83397313bb17e9c065b5c8e09))

## [1.13.0](https://github.com/aboydnw/cng-sandbox/compare/v1.12.0...v1.13.0) (2026-04-08)


### Features

* add connection report card drawer with stepped content ([#149](https://github.com/aboydnw/cng-sandbox/issues/149)) ([42be995](https://github.com/aboydnw/cng-sandbox/commit/42be995998aa17657d59f3261361c4bef6b1184a))
* catch duplicate dataset uploads ([#140](https://github.com/aboydnw/cng-sandbox/issues/140)) ([3c4cd19](https://github.com/aboydnw/cng-sandbox/commit/3c4cd199a096c53701ef55820ad41c20f0a0f50d))
* preflight duplicate check before upload ([#142](https://github.com/aboydnw/cng-sandbox/issues/142)) ([2b0a6b1](https://github.com/aboydnw/cng-sandbox/commit/2b0a6b1c10fb8c744d30b1b3e1865c23919b4227))
* show warning when connection probe fails ([#146](https://github.com/aboydnw/cng-sandbox/issues/146)) ([8d66a7f](https://github.com/aboydnw/cng-sandbox/commit/8d66a7f81f075ff7fec0e688d4a9a4f56eb9dcb5))
* unify map sidebar between datasets and connections ([#148](https://github.com/aboydnw/cng-sandbox/issues/148)) ([e5775eb](https://github.com/aboydnw/cng-sandbox/commit/e5775eb6f9bc2609c24765c284e0f8cab1954a11))


### Bug Fixes

* PMTiles connections not rendering when tile_type is null ([#143](https://github.com/aboydnw/cng-sandbox/issues/143)) ([7d5ccf3](https://github.com/aboydnw/cng-sandbox/commit/7d5ccf3037692aae9ccfbf1c621518bf7e5b9086)), closes [#139](https://github.com/aboydnw/cng-sandbox/issues/139)
* proxy streaming response closes httpx client prematurely ([#144](https://github.com/aboydnw/cng-sandbox/issues/144)) ([3a13fa9](https://github.com/aboydnw/cng-sandbox/commit/3a13fa998f6e23868021d2f76537d1101bdd42fb))

## [1.12.0](https://github.com/aboydnw/cng-sandbox/compare/v1.11.0...v1.12.0) (2026-04-06)


### Features

* story editor panel redesign ([#134](https://github.com/aboydnw/cng-sandbox/issues/134)) ([cb2e7df](https://github.com/aboydnw/cng-sandbox/commit/cb2e7dfc087f69d3c9a56fae9fe24be4252f7b3c))


### Bug Fixes

* story editor dropdown polish and portal pattern ([#137](https://github.com/aboydnw/cng-sandbox/issues/137)) ([82a45bf](https://github.com/aboydnw/cng-sandbox/commit/82a45bfcb26b6102e401f2561bfc81ab93b45239))
* story editor timestep selection not applied to map ([#138](https://github.com/aboydnw/cng-sandbox/issues/138)) ([9021c5b](https://github.com/aboydnw/cng-sandbox/commit/9021c5b1ef0299757e7c297d500579b1cf9430c7))

## [1.11.0](https://github.com/aboydnw/cng-sandbox/compare/v1.10.0...v1.11.0) (2026-04-04)


### Features

* temporal browsing and story integration ([#129](https://github.com/aboydnw/cng-sandbox/issues/129)) ([4d48388](https://github.com/aboydnw/cng-sandbox/commit/4d483886b0eac92fedfa0e76f0f7a2e2fd606c67))


### Bug Fixes

* calendar popover styling and clickability ([#133](https://github.com/aboydnw/cng-sandbox/issues/133)) ([f638b39](https://github.com/aboydnw/cng-sandbox/commit/f638b39929f7f54935cb635664806daf4a593ae1))
* hide preload progress in browse mode, improve calendar pill padding ([#132](https://github.com/aboydnw/cng-sandbox/issues/132)) ([8ca796a](https://github.com/aboydnw/cng-sandbox/commit/8ca796af91612c03633fd00877ad3acb3b32b1cc))

## [1.10.0](https://github.com/aboydnw/cng-sandbox/compare/v1.9.3...v1.10.0) (2026-04-02)


### Features

* improve guided tour with overlay layout and fly-to fix ([#120](https://github.com/aboydnw/cng-sandbox/issues/120)) ([6e1e47c](https://github.com/aboydnw/cng-sandbox/commit/6e1e47c14215464c3989f5c517077025f61f82af))
* production stability improvements ([63a09a2](https://github.com/aboydnw/cng-sandbox/commit/63a09a2b453d537dfcc3a0864e3a8caad805c818))
* remote data connection with mosaic and temporal ingestion ([#119](https://github.com/aboydnw/cng-sandbox/issues/119)) ([30fc497](https://github.com/aboydnw/cng-sandbox/commit/30fc497ad0b337aa4225c9cd5b1be8ce7f625c5e))


### Bug Fixes

* enable deck.gl controller for transitions in non-interactive maps ([#124](https://github.com/aboydnw/cng-sandbox/issues/124)) ([eef4c5c](https://github.com/aboydnw/cng-sandbox/commit/eef4c5c8de94de285c480edbc7272d084d895253))
* enable deck.gl controller for transitions in non-interactive maps ([#128](https://github.com/aboydnw/cng-sandbox/issues/128)) ([e43e752](https://github.com/aboydnw/cng-sandbox/commit/e43e752a7a3b19f920567fe236262a9bbfc2ab8a))
* feed intermediate camera frames back to deck.gl during fly-to ([#125](https://github.com/aboydnw/cng-sandbox/issues/125)) ([6d18edf](https://github.com/aboydnw/cng-sandbox/commit/6d18edf1d7a7a95fd56ecb94c3761d2c845820ab))
* feed intermediate camera frames back to deck.gl during fly-to ([#125](https://github.com/aboydnw/cng-sandbox/issues/125)) ([#127](https://github.com/aboydnw/cng-sandbox/issues/127)) ([03381b1](https://github.com/aboydnw/cng-sandbox/commit/03381b1813e0db5fb39aeb90cd0f226804cfd5c3))
* guided tour overlay follow-up improvements ([#122](https://github.com/aboydnw/cng-sandbox/issues/122)) ([2636fa1](https://github.com/aboydnw/cng-sandbox/commit/2636fa1bd5a625ae965343cf1f5f055af7d2f507))
* scrollytelling initialization and scroll context for overlay layout ([#123](https://github.com/aboydnw/cng-sandbox/issues/123)) ([a484eac](https://github.com/aboydnw/cng-sandbox/commit/a484eac808159e9e44c4f825fb506857f0b8f1ec))
* use controller={true} with pointer-events for fly-to transitions ([#126](https://github.com/aboydnw/cng-sandbox/issues/126)) ([b0b2227](https://github.com/aboydnw/cng-sandbox/commit/b0b222756e4b34b7765bf3b43e3fbb910f59e6ea))

## [1.9.3](https://github.com/aboydnw/cng-sandbox/compare/v1.9.2...v1.9.3) (2026-04-01)


### Bug Fixes

* add missing uri strip_prefix for COG tiler proxy ([#112](https://github.com/aboydnw/cng-sandbox/issues/112)) ([ef53ea1](https://github.com/aboydnw/cng-sandbox/commit/ef53ea138cfe63522458fd0b55b2da22287a471f)), closes [#111](https://github.com/aboydnw/cng-sandbox/issues/111)
* progressively preload temporal timesteps instead of all at once ([#109](https://github.com/aboydnw/cng-sandbox/issues/109)) ([a28a838](https://github.com/aboydnw/cng-sandbox/commit/a28a838387a1b7d2c24f013c4ad9744f3d9153f1))

## [1.9.2](https://github.com/aboydnw/cng-sandbox/compare/v1.9.1...v1.9.2) (2026-04-01)


### Bug Fixes

* handle 3D HDF5 datasets in pixel fidelity validator ([#106](https://github.com/aboydnw/cng-sandbox/issues/106)) ([5461abb](https://github.com/aboydnw/cng-sandbox/commit/5461abb041e01818033ab99ceaa3b8620bb4dd1b))

## [1.9.1](https://github.com/aboydnw/cng-sandbox/compare/v1.9.0...v1.9.1) (2026-04-01)


### Bug Fixes

* add cache-control headers to prevent stale assets after deploy ([#102](https://github.com/aboydnw/cng-sandbox/issues/102)) ([e611bf6](https://github.com/aboydnw/cng-sandbox/commit/e611bf64824d453946c4665cd6db842f01f7e7a3))
* rewrap 0-360 longitudes in NetCDF validator to match converter ([#104](https://github.com/aboydnw/cng-sandbox/issues/104)) ([84fd16f](https://github.com/aboydnw/cng-sandbox/commit/84fd16f2fc71ae468d30e9fffebaae7165e1896a)), closes [#101](https://github.com/aboydnw/cng-sandbox/issues/101)

## [1.9.0](https://github.com/aboydnw/cng-sandbox/compare/v1.8.1...v1.9.0) (2026-04-01)


### Features

* in-file temporal extraction for NetCDF and HDF5 ([#99](https://github.com/aboydnw/cng-sandbox/issues/99)) ([1e33653](https://github.com/aboydnw/cng-sandbox/commit/1e33653e7a80593ddc8a1927edfbcc0382d6e9bd))


### Bug Fixes

* address CodeRabbit review feedback ([86984d5](https://github.com/aboydnw/cng-sandbox/commit/86984d523c06b264aa1297c036d5358d88caebd4))
* use cascading delete in TTL cleanup and add orphan detection script ([#92](https://github.com/aboydnw/cng-sandbox/issues/92)) ([2555d9b](https://github.com/aboydnw/cng-sandbox/commit/2555d9b8eb1d64009a175873f755e1388ab532cc))

## [1.8.1](https://github.com/aboydnw/cng-sandbox/compare/v1.8.0...v1.8.1) (2026-04-01)


### Bug Fixes

* simplify progress indicators to elapsed timers with context labels ([#90](https://github.com/aboydnw/cng-sandbox/issues/90)) ([1802d4f](https://github.com/aboydnw/cng-sandbox/commit/1802d4f64ba09f7cf10ad4825d45a75aa3950061))

## [1.8.0](https://github.com/aboydnw/cng-sandbox/compare/v1.7.0...v1.8.0) (2026-03-31)


### Features

* add per-stage progress indicators to upload workflow ([#85](https://github.com/aboydnw/cng-sandbox/issues/85)) ([3cbd8ef](https://github.com/aboydnw/cng-sandbox/commit/3cbd8efe20674d03eac7cdd24c2bd2978946909a))


### Bug Fixes

* add item ID to bounds-zoom dependency ([56f23f6](https://github.com/aboydnw/cng-sandbox/commit/56f23f6c27ab55390f66ab4dc4b45e8c935e71b6))
* add upload size limit and timeouts to Caddy proxy ([#86](https://github.com/aboydnw/cng-sandbox/issues/86)) ([3521fd7](https://github.com/aboydnw/cng-sandbox/commit/3521fd7ebaa010a46d3f8ae2f3f4c1e877d7da38))

## [1.7.0](https://github.com/aboydnw/cng-sandbox/compare/v1.6.0...v1.7.0) (2026-03-31)


### Features

* disable client-side rendering for COGs over 200 MB ([#84](https://github.com/aboydnw/cng-sandbox/issues/84)) ([ab5fd74](https://github.com/aboydnw/cng-sandbox/commit/ab5fd74238aed92349e5180ddf02afb525b7a55b))
* redesign homepage with three equal-weight cards ([#80](https://github.com/aboydnw/cng-sandbox/issues/80)) ([9bb65d2](https://github.com/aboydnw/cng-sandbox/commit/9bb65d2ee693d40b6e8b302a3b818462e793799c))
* universal CRS reprojection for all raster formats ([#81](https://github.com/aboydnw/cng-sandbox/issues/81)) ([35011b4](https://github.com/aboydnw/cng-sandbox/commit/35011b45e31c21db4f918426daf6d998b32b91a5))


### Bug Fixes

* ensure fresh frontend assets on every deploy ([#78](https://github.com/aboydnw/cng-sandbox/issues/78)) ([a8dc212](https://github.com/aboydnw/cng-sandbox/commit/a8dc212dcfb9588425fc7f6de21f10c3e556ac1d))
* handle large raster files without OOM crashes ([#82](https://github.com/aboydnw/cng-sandbox/issues/82)) ([b3d9589](https://github.com/aboydnw/cng-sandbox/commit/b3d95895582ecf77e802e0cb90e733fcbd472b19))
* skip pixel fidelity check for reprojected GeoTIFFs ([#83](https://github.com/aboydnw/cng-sandbox/issues/83)) ([6a880d0](https://github.com/aboydnw/cng-sandbox/commit/6a880d0a1af5609105b0e77ab2a3f855eabb4ffb))
* use overview reads in compute_global_stats to avoid OOM ([00f9899](https://github.com/aboydnw/cng-sandbox/commit/00f989940cd7a1489e342d9a18bc0dc86867fab6))

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
