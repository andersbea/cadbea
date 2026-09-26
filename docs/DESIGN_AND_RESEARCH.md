# Design and Research

## Status and Objective

This is a planning document, not a description of implemented APIs. The nine
ideas below were accepted as project direction. Additional proposals and
technical investigations remain explicitly identified. The objective is to
reduce modeling time, agent context, computation, and correction cycles while
keeping the user's intent and dimensional constraints visible.

## Accepted Capabilities

### 1. Connect Geometry to Source and Intent

Give each part a stable ID, source module, parameter references, documentation,
and related feedback. Separate reusable part definitions from assembly
instances so selecting one of several identical screws identifies its location.
Let both the viewer and agent request the context for a single part.

Prefer named features and semantic references over raw face indices. Stable
part identity does not guarantee stable face identity after a boolean operation;
unresolved references must be reported explicitly.

### 2. Preserve Reproducible Review States

Store annotations with the model revision, resolved parameters, camera,
section plane, selected instance or feature, and original screenshot or sketch.
Record feedback status and the revision in which it was addressed. Keep stale
annotations visible and request relocation when their target cannot be resolved.

Review views should be restorable so the AI and user can inspect the same
feature. Onshape's [named views][views] and [contextual comments][comments]
provide useful precedents.

### 3. Package Connections Alongside Parts

Provide reusable fasteners with matching clearance holes, counterbores,
washers, insertion directions, and tool-access envelopes. Extend this approach
to inserts, bearing seats, hinges, and board mounting patterns.

Separate nominal hardware dimensions from fit allowances and manufacturing
profiles. Record vendor references, asset versions, and redistribution licenses.
Imported reference geometry and editable parametric parts should be identified
separately. [bd_warehouse][fasteners] demonstrates fastener-driven holes and
simplified threads; adapting the concept to Replicad requires implementation.

### 4. Share Parameters Across Levels of Detail

Offer an optional diagram or block model before detailed CAD, with the user's
agreement. Support an engineering preview that retains critical interfaces and
a detailed representation for export. Defer expensive cosmetic details when
they do not affect the current decision.

Share parameter definitions and part IDs across representations. Label the
active level of detail and its omissions. A preview should not silently become
the exported artifact; validate the actual export representation.

### 5. Rebuild Only Affected Parts

Use part builders with explicit inputs and dependencies. Investigate caching
by source, parameters, dependency versions, assets, detail level, and kernel
version. An edit to a lid label should not rebuild unrelated fasteners.

Run the kernel in a worker, retain the last successful preview, label stale
results, and discard superseded build responses. Replicad [recommends a worker
for its WebAssembly kernel][worker]. Incremental caching is our proposed work,
not an assumed Replicad capability.

### 6. Make Requirements Executable

Attach checks to requirements: mounting-hole spacing, clearance, expected solid
count, bounds, and prohibited intersections. Test representative parameter
boundaries and combinations, including invalid inputs with useful diagnostics.
Distinguish mesh checks, CAD geometry checks, and manufacturing heuristics;
watertightness alone does not establish fit or manufacturability.

Keep physical configurations separate from presentation states. Exploding an
assembly for review must not change the geometry used to evaluate assembled
fit. Report failures with part IDs, relevant parameters, and a useful view.

### 7. Record Measurement Provenance and Uncertainty

Classify parameters as fixed, adjustable, or derived. Independently record the
source, units, uncertainty, and confirmation status of each measurement. Fixed
does not imply verified: a fixed interface dimension may still be an assumption.

Preserve original sketches and document the interpreted orientation, features,
and constraints. Calibrate against a known dimension when available; otherwise
use sketches to establish intent without inventing precise measurements.

### 8. Return Compact Inspection Results

Expose targeted inspection through a common library/CLI contract, with optional
agent adapters. Return the model revision, changed part IDs, resolved parameters,
failed checks, and a small set of views. Generate close-ups or sections around
selected features and failures on demand.

Package a short core workflow skill plus task-specific references and tested
examples for enclosures, fasteners, sketches, and debugging. Load only relevant
material. Catalog entries should expose concise parameter and capability
summaries before loading full implementations.

### 9. Benchmark the Complete Modeling Loop

Use a bracket, board enclosure, adapter around an imported part, and multi-part
assembly as initial benchmark tasks. Include revisions, not just first builds.
Measure time to first useful preview, cold/warm rebuild time, agent tokens,
correction cycles, validation success, and export success.

Record model/provider version, task inputs, package versions, and cache state.
Include failed attempts and repair costs. Compare equivalent outcomes over
repeated runs; do not claim token savings from code size alone.

## Additional Proposals

### Assembly Anchors and Access Envelopes

Define named local coordinate frames such as `board.mountingPlane` or
`lid.hingeAxis`, with explicit units and transforms. Use these to place parts,
derive explode directions, and describe interfaces. Begin with deterministic
placements before considering a general constraint solver. Model insertion,
cable-bend, and tool-access envelopes where relevant to the design.

### Revision Comparison and Alternatives

Show before/after models with the same camera, changed-part highlighting, and
parameter differences. Allow a few named parameter alternatives to appear in
one contact sheet so the user can compare proportions quickly. Keep feedback
associated with the chosen alternative and revision.

### Generate Documentation from Model Metadata

Generate parameter tables, part indexes, and bills of materials from typed
metadata, while preserving authored rationale and references. This reduces
drift between documentation, viewer controls, and agent context. Include units
and dimensional meaning in parameter schemas to catch incompatible inputs.

### Reproducible Export Bundles

Associate each export with its source revision, resolved parameters, units,
kernel/library versions, validation results, and review images. Export geometry
from the requested physical configuration, independent of an exploded or hidden
viewer state. This makes a downloaded file traceable to the reviewed model.

### Actionable Failures and Recovery

Report the failing part and named operation, input parameters, and available
diagnostics when geometry construction fails. Preserve the last successful
result for comparison without presenting it as current. Keep regression cases
for repaired failures so future agents can reuse verified solutions.

## Research Findings and Boundaries

[Nimbalyst's Replicad extension][nimbalyst] describes TypeScript models,
parameter controls, selected-face measurements for agents, multi-view
inspection, and STEP imports. It is a close reference for tool contracts.
Its documented model import restriction to `replicad` also makes modular
multi-file projects an important distinction for this library. These are
documented capabilities, not independently benchmarked results.

[Zoo's KCL design discussion][kcl] provides context on readable parametric
programs and component reuse. We retain TypeScript/Replicad as the chosen
authoring foundation; adopting another modeling language is outside this plan.

The referenced projects are sources of design ideas. Reusing code, datasets,
or assets requires checking the relevant version and license individually.

## Focused Investigations Before Implementation

Broad product research is sufficient for the current direction. Resolve these
questions with small prototypes and version-specific documentation before
committing to public contracts:

| Investigation | Evidence needed |
| --- | --- |
| Geometry identity | Change dimensions and booleans; test which selections survive and how unresolved annotations are detected. |
| Kernel lifecycle and caching | Test ownership, cloning, disposal, serialization, memory use, cancellation, and invalidation of cached geometry. |
| Multi-file TypeScript builds | Verify consumer imports, worker bundling, WASM loading, diagnostics, and one shared Three.js instance. |
| Geometry validation and exports | Establish which measurements, validity checks, and assembly exports the chosen Replicad/kernel versions expose; document gaps. |
| Parameter and assembly contracts | Prototype derived values, cross-parameter constraints, repeated instances, and local coordinate frames. |
| Skills and catalog distribution | Verify a portable installation path, compatibility/version rules, and licenses for initial parts and data. |

## Delivery Priorities

1. Establish strict TypeScript, linting, tests, and a small representative model
   with baseline timings and agent costs.
2. Deliver one complete review loop: part metadata, selection, annotation,
   parameter edit, build, validation, and revision-matched snapshot.
3. Add progressive detail, targeted inspection, core workflow skills, and a
   small connection catalog backed by tested examples.
4. Add incremental caching, richer fit checks, comparison views, generated
   documentation, and traceable exports as measurements justify the work.

## Implemented First Slice

The current first slice delivers the review loop in the generic viewer and the
GC CAD example: named meshes are clickable, the selected part is highlighted,
the selection includes a part ID and optional model-space hit point, and notes
capture selection, camera, state, and timestamp. The example presents this in
an AI review panel, while `getReviewState()` provides a serializable contract.
Annotations remain in memory. Persistence, sketch attachments, face-stable
references, parameter controls, and React extraction remain follow-up work.

## IDE-Style AI Communication

The browser is an interactive client, while the AI may run the dev server,
browser automation, and model tools as separate processes. A browser console is
useful for an AI that owns the page through Playwright, but browser console
output does not automatically enter the Vite server's stdout. The current
viewer therefore supports three compatible paths:

| Path | Use | Current status |
| --- | --- | --- |
| Same-page API | `getReviewState()`, selection, and annotations for a connected browser tool | implemented |
| Browser event stream | `CustomEvent('cadbea-review')` and `[cadbea]` structured console lines | implemented |
| Webhook | `reviewWebhook` POSTs review events to a local AI-owned endpoint | implemented |

The recommended local IDE architecture is a small bridge process:

```text
browser UI → webhook / console adapter → append-only event queue → AI tool
AI tool → command endpoint → browser UI
```

The bridge should persist JSONL events with a session ID, model revision,
event ID, timestamp, selection/annotation, and acknowledgement status. It
should expose commands for selecting a part, restoring a camera, changing a
review state, applying a parameter override, and requesting a snapshot. This
supports both an AI that tails a local queue and an AI that calls explicit
tools; it does not require the browser to know which agent is connected.

Use event IDs and acknowledgements so reconnects do not duplicate feedback.
Reject or isolate webhook origins in shared environments. Keep the browser
event payload serializable and bounded; store large sketches and images as
artifacts referenced by ID rather than embedding them in every event.

## Sources

These primary sources were consulted during project planning on 2026-09-20.

- [Nimbalyst Replicad README][nimbalyst]
- [bd_warehouse fasteners and holes][fasteners]
- [Replicad: use as a library][worker]
- [Onshape named views][views]
- [Onshape contextual comments][comments]
- [Zoo: introducing KCL][kcl]

[nimbalyst]: https://github.com/nimbalyst/nimbalyst-replicad/blob/main/README.md
[fasteners]: https://bd-warehouse.readthedocs.io/en/latest/fastener.html
[worker]: https://github.com/sgenoud/replicad/blob/main/packages/replicad-docs/docs/use-as-a-library.md
[views]: https://cad.onshape.com/help/Content/View/named_views.htm
[comments]: https://cad.onshape.com/help/Content/Collaboration/comments_on_workspaces.htm
[kcl]: https://docs.zoo.dev/research/introducing-kcl
