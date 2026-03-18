# CNG Sandbox: Guided Self-Hosting

## Lowering the Barrier to Self-Hosted CNG Infrastructure — Without Becoming a SaaS

*Product Concept Brief — March 2026*

---

## The Problem

CNG Sandbox teaches users what cloud-native geospatial formats are and how they work. But after they've converted a GeoTIFF to COG, inspected its overviews, searched a STAC catalog, and built a map preview in the sandbox — the next question is always: **"How do I actually deploy this?"**

Today, the answer is daunting. [Deploying eoAPI on AWS](https://eoapi.dev/deployment/aws/) requires cloning a template repo, setting up a Python virtual environment, installing CDK and Node.js, configuring AWS credentials, editing a YAML config file, bootstrapping CloudFormation, and running `npx cdk deploy`. The [Kubernetes path](https://eoapi.dev/deployment/) requires Helm charts, cluster provisioning, and ingress controller configuration. Even the [local Docker Compose](https://github.com/developmentseed/eoAPI) setup requires Docker knowledge, multiple environment variables, and manual data ingestion into pgSTAC.

For the scientist, GIS analyst, or NGO staffer who just learned what a COG is in the sandbox, these deployment paths are effectively inaccessible. The sandbox creates excitement and understanding — then drops the user off a cliff.

**The idea: what if the sandbox didn't just teach CNG formats, but also guided users through deploying their data on infrastructure they own?** Not a managed service. Not a SaaS. A wizard that walks a non-engineer through setting up self-hosted, open-source CNG infrastructure — with the user owning every component.

---

## Design Principles

**1. The user owns everything.** Every file, every service, every URL runs on the user's own accounts. DevSeed hosts nothing in production. If CNG Sandbox disappeared tomorrow, the user's infrastructure keeps running. This is philosophically aligned with DevSeed's open-source identity and avoids the SaaS trap.

**2. Progressive complexity.** Start with the simplest possible deployment (static files on object storage), and let users opt into more complex infrastructure (tile server, dynamic STAC API) only when they need it. Most users will never need a full eoAPI stack.

**3. One happy path first.** Don't try to support AWS + GCS + Azure + R2 on day one. Pick the simplest, cheapest, most accessible path and make it bulletproof. Expand later.

**4. The sandbox is the workbench, not the host.** The sandbox is where you prep, preview, and configure. The deploy wizard pushes to the user's infrastructure. This keeps our costs predictable and our product scope manageable.

---

## The Deployment Spectrum

Not every user needs the same infrastructure. The guided self-hosting feature should offer a spectrum, from dead-simple to full-featured:

### Tier 0: Static files on object storage (no server at all)

**What it is:** COGs + static STAC catalog JSON + a PMTiles basemap, all sitting in an S3-compatible bucket. The viewer is a static HTML page (exported from the sandbox's map builder) that uses [maplibre-cog-protocol](https://github.com/phayes/maplibre-cog-protocol) for client-side COG rendering and the [PMTiles JS library](https://protomaps.com/docs/pmtiles/) for basemap tiles. Everything renders in the browser. No server, no database, no tile service.

**What the wizard does:**
1. User connects their storage account (S3 bucket, or Cloudflare R2 — see below)
2. Sandbox uploads the optimized COGs and generated STAC catalog JSON
3. Sandbox exports the map viewer as a static site
4. User deploys the viewer to Vercel, GitHub Pages, or the same bucket (with static hosting enabled)

**What the user gets:** A shareable URL showing their data on a map. Total monthly cost: a few cents for storage, zero for compute.

**Limitations:** Client-side COG rendering works for moderate-resolution data but struggles with large or multi-band imagery. No server-side band math, reprojection, or mosaicking. The STAC catalog is static JSON — no search API, no dynamic queries. This is a display tier, not an analysis tier.

**Who it's for:** Researchers sharing results, NGOs publishing datasets, students building portfolio projects, anyone who just needs "my data on a map with a link."

### Tier 1: Add a tile server (TiTiler)

**What it is:** Everything from Tier 0, plus a lightweight TiTiler instance that provides dynamic tile serving — band math, rescaling, colormaps, reprojection on the fly. The TiTiler reads COGs directly from the user's object storage.

**What the wizard does:**
1. Everything from Tier 0
2. Generates a TiTiler configuration pointed at the user's bucket
3. Guides the user through deploying TiTiler as a containerized service

**The deployment target question:** This is where it gets hard for non-engineers. TiTiler is a Python/FastAPI application that runs as a Docker container. Where does a non-engineer deploy a Docker container?

Options explored:

- **AWS Lambda via eoapi-cdk**: This is what [eoAPI's AWS deployment](https://eoapi.dev/deployment/aws/) uses. TiTiler runs as a Lambda function behind API Gateway. Serverless, pay-per-request, scales to zero. But the deployment process requires CDK, Node.js, Python, and AWS CLI — all engineer tools. **Could the sandbox automate this?** Potentially. If the user provides AWS credentials (via OAuth or access keys), the sandbox could run the CDK deploy on their behalf. This is technically feasible but raises security concerns (handling user's AWS credentials) and support burden (debugging failed deploys across diverse AWS account configurations).

- **Fly.io / Railway / Render**: These are "platform-as-a-service" providers that deploy Docker containers without the user managing servers. You push a container image, they run it, you get a URL. Pricing starts at ~$5/month. **However, DevSeed does not use any of these for eoAPI today.** The current eoAPI deployment targets are Docker Compose (local), [AWS CDK (production)](https://github.com/developmentseed/eoapi-cdk), and [Kubernetes via Helm charts](https://eoapi.dev/deployment/). These PaaS options would be a new, untested deployment path that we'd need to build and maintain. The user experience is simpler than CDK, but still requires creating an account, understanding what a "service" is, and configuring environment variables.

- **A one-click deploy button (like Vercel/Heroku "Deploy" buttons)**: The most user-friendly option. A "Deploy TiTiler" button that opens a pre-configured deploy flow on a PaaS provider. The user creates an account (or logs into an existing one), clicks deploy, and gets a URL. **This is the most promising path for non-engineers**, but it requires us to maintain deploy templates for the target platform and ensure TiTiler runs correctly in those environments. We'd also be recommending a specific vendor, which may feel at odds with our vendor-neutral positioning — though the user still owns the deployment and can move it.

**Honest assessment:** Tier 1 is the hardest tier to make accessible to non-engineers. There is currently no way to deploy a Docker container that is as simple as deploying a static site. Every option requires the user to understand at least one infrastructure concept (containers, environment variables, cloud accounts). We may need to accept that Tier 1 is for "technical-but-not-devops" users — someone who can follow a step-by-step guide with screenshots, but can't write a CDK stack from scratch.

**Who it's for:** Users with multi-band imagery who need band math, users serving raster data to web applications, teams building dashboards that need dynamic tile endpoints.

### Tier 2: Add a dynamic STAC catalog (full eoAPI)

**What it is:** The full eoAPI stack — pgSTAC (Postgres with STAC extensions), stac-fastapi, TiTiler-pgSTAC, and optionally TiPG for vector tiles. This gives the user a searchable, standards-compliant STAC API, dynamic mosaic creation from STAC queries, and all the capabilities that power NASA VEDA and Microsoft Planetary Computer.

**What the wizard does:** This is where the wizard likely hands off to documentation rather than automation. A full eoAPI deployment requires a managed Postgres instance, proper networking, authentication, and ongoing maintenance. Even with [eoapi-cdk](https://github.com/developmentseed/eoapi-cdk) abstracting much of the AWS complexity, this is a team deployment, not a solo deploy.

**What the wizard can realistically do:**
1. Generate a pre-filled `config.yaml` for eoapi-template based on the user's data and preferences
2. Provide a step-by-step guide customized to their cloud provider
3. Validate their data is STAC-compliant before they attempt ingestion
4. Offer a "try before you deploy" mode where the sandbox simulates the eoAPI experience with their data (static STAC + TiTiler) so they can verify the result before committing to infrastructure

**Who it's for:** Organizations building production geospatial infrastructure. Teams that need multi-user access, authentication, and a full STAC API. This is the tier where DevSeed's consulting services naturally plug in — the sandbox generates the lead, and DevSeed helps with the deployment.

---

## The Recommended "Happy Path" for v1

**Tier 0 is the v1 target.** It's the simplest to build, requires zero server-side infrastructure from us, and answers the "now what?" question for the largest number of users.

### Why Cloudflare R2 as the default storage target

For the v1 happy path, [Cloudflare R2](https://developers.cloudflare.com/r2/pricing/) is a strong default recommendation over AWS S3:

- **Zero egress fees.** This is the single biggest advantage for CNG data. COGs served via HTTP range requests generate significant egress traffic. On S3, [egress costs $0.09/GB after the first 100GB](https://www.digitalapplied.com/blog/cloudflare-r2-vs-aws-s3-comparison). On R2, it's free. For a user serving 100GB of COG tiles per month, that's $9/month saved — which compounds fast for popular datasets.
- **S3-compatible API.** [R2 exposes the same S3 API](https://www.cloudflare.com/developer-platform/products/r2/), so all existing S3 tooling (boto3, aws-cli with custom endpoint, rclone) works by changing one endpoint URL. TiTiler, STAC Browser, and all CNG tools that read from S3 work with R2 out of the box.
- **Generous free tier.** [10GB storage, 1M Class A operations, 10M Class B operations per month](https://developers.cloudflare.com/r2/pricing/) — enough for a researcher's dataset or a small NGO's published results at zero cost.
- **No AWS account required.** Many of our target users (academic researchers, NGO staff, government analysts) don't have personal AWS accounts and face institutional barriers to creating them. A Cloudflare account is simpler to set up.
- **Public bucket support.** R2 supports public buckets with custom domains, which means a COG can be served directly to maplibre-cog-protocol without any authentication configuration.

We'd also support AWS S3 for users who already have AWS accounts, but R2 would be the guided default for new users.

### The v1 wizard flow

1. **Prep** (already in sandbox scope): Upload files → convert to COG → generate STAC metadata → preview on map → customize the viewer
2. **Storage setup**: "Connect your storage" → guided R2 account creation or S3 bucket connection → sandbox pushes COGs + STAC JSON to the bucket
3. **Viewer deploy**: "Deploy your map" → export static viewer → one-click deploy to Vercel (or download as a zip for self-hosting)
4. **Result**: User has a URL. Their data is on R2 (they own it), their viewer is on Vercel (they own it), everything is open-source and portable.

### What this doesn't include (and why)

- **No TiTiler deployment in v1.** Client-side COG rendering handles the most common visualization needs. Users who need server-side tile generation can be pointed to documentation or DevSeed consulting.
- **No pgSTAC/dynamic STAC API in v1.** Static STAC catalogs are sufficient for datasets under a few hundred items. Larger catalogs can be flagged as needing a Tier 2 deployment.
- **No credential storage.** The sandbox should never store cloud credentials. Use OAuth flows or one-time upload tokens. If the user disconnects, the sandbox forgets.

---

## How This Changes the Product Narrative

Without guided self-hosting, CNG Sandbox's story is: "Learn what CNG formats are and how they work."

With it, the story becomes: **"Go from files on your laptop to a live, self-hosted map application — without writing code or managing servers."**

This is a fundamentally different value proposition. It's no longer just educational — it's productive. The user leaves with something real: a URL, a catalog, a viewer. And because they own everything, there's no lock-in to DevSeed's infrastructure.

For the GEE migration audience specifically, this closes the loop: "You exported your GeoTIFFs from Earth Engine. Drop them here. We'll optimize them, catalog them, and help you deploy them on your own infrastructure — for a fraction of what GEE charges."

For the broader CNG learner audience, it transforms the sandbox from a learning tool into a launchpad: "Learn the formats, then ship with them."

---

## Risks and Open Questions

**Risk: Scope creep.** The Tier 0 wizard is buildable. Tiers 1 and 2 are research projects. We need strict discipline about shipping Tier 0 first and gathering real user feedback before investing in higher tiers.

**Risk: Support burden.** Even with Tier 0, users will have issues with R2 bucket permissions, CORS configuration, and Vercel deployments. We need to decide upfront: is guided self-hosting a "best effort, follow the guide" feature, or a supported product with a help channel?

**Risk: Large file uploads.** GEE users may arrive with multi-GB files. Browser-based uploads to R2 are feasible (R2 supports multipart upload), but we need to test the UX for files in the 1–5GB range. Above 5GB, we may need to offer a CLI-based upload path, which compromises the "no engineering required" promise.

**Open question: Do we build the R2/Vercel integrations ourselves, or partner?** Cloudflare and Vercel both have partner programs. A co-marketing arrangement ("Deploy your CNG data with Cloudflare R2") could give us free credits for users and distribution through their channels.

**Open question: Where does STAC Manager fit?** DevSeed recently built [STAC Manager](https://developmentseed.org/blog/2025-06-18-eoapi/) — a web CRUD interface for STAC catalogs. If we deploy a static STAC catalog in Tier 0, and the user later wants to edit it, STAC Manager could be the bridge to Tier 1/2. This is a natural product integration but needs scoping.

**Open question: Is this a free feature or a paid tier?** The sandbox itself may be free (for learning), but the deployment wizard — which provides real, lasting infrastructure value — could be the trigger for a paid tier. "Learn for free, deploy for $X/month" is a clean conversion point. Though the deployment itself costs the user nothing from us (they pay R2 and Vercel directly), the wizard that makes it easy is our value-add.

---

## Source Index

### eoAPI Deployment
- [eoAPI Deployment Docs](https://eoapi.dev/deployment/)
- [eoAPI AWS CDK Deployment](https://eoapi.dev/deployment/aws/)
- [eoapi-cdk GitHub](https://github.com/developmentseed/eoapi-cdk)
- [eoapi-cdk on PyPI](https://pypi.org/project/eoapi-cdk/)
- [eoapi-cdk API Reference](http://developmentseed.org/eoapi-cdk/)
- [eoapi-template GitHub](https://github.com/developmentseed/eoapi-template)
- [What's New in eoAPI (STAC Manager, Auth Proxy, Cloud-agnostic Helm)](https://developmentseed.org/blog/2025-06-18-eoapi/)

### Cloudflare R2
- [R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
- [R2 Product Page](https://www.cloudflare.com/developer-platform/products/r2/)
- [R2 Pricing Calculator](https://r2-calculator.cloudflare.com/)
- [R2 vs S3 Comparison (Digital Applied)](https://www.digitalapplied.com/blog/cloudflare-r2-vs-aws-s3-comparison)
- [R2 Free Tier and Egress (Oreate AI)](https://www.oreateai.com/blog/cloudflare-r2-demystifying-the-free-tier-and-egress-in-2025/d77969f5e07c62d5f20ba83c0ecbd93e)
- [Introducing R2 (Cloudflare Blog)](https://blog.cloudflare.com/introducing-r2-object-storage/)
- [R2 vs S3 (Cloudflare comparison page)](https://www.cloudflare.com/pg-cloudflare-r2-vs-aws-s3/)
