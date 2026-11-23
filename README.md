# PWA Web OS

PWA Web OS is a planned personal workspace that runs in the browser and can be installed as a Progressive Web App. A shared launcher opens tools such as Notes, and the workspace adapts from a focused mobile view to a larger desktop layout.

The long-term design goal is to let people keep working across devices, browser changes, and software updates while retaining control of their files. See the [product specification](docs/PRODUCT_SPEC.md) for the first release and its acceptance criteria.

## Project status

The repository is at the specification stage. There is no runnable PWA, build command, or deployment yet.

The first release targets Windows, macOS, iOS, and Android. Chrome and Firefox are required for browser use on all four platforms. See the [platform matrix](docs/PRODUCT_SPEC.md#platform-support) for install modes.

## Development

Use the [feature map](docs/FEATURE_MAP.md) to see first-release scope, feature dependencies, and a suggested implementation order.

Track implementation and verification in the [development task checklist](Task.md).

See the [modular development plan](docs/MODULAR_WEB_OS_PLAN.md) for module boundaries, failure handling, and milestone gates.

Start with the [first-release acceptance criteria](docs/PRODUCT_SPEC.md#acceptance-criteria). The first implementation should prove a complete Notes workflow from offline editing through update and data transfer. Add local setup, build, and test commands to the repository once those commands have been verified.
