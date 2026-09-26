# AI-First CAD Project Vision

This document describes the intended product. The current repository contains
a JavaScript viewer and capture/check tools; the TypeScript framework, React
shell, catalog, and packaged skills are planned work.

See [Design and Research](docs/DESIGN_AND_RESEARCH.md) for accepted ideas,
priorities, additional proposals, and implementation questions.

## Purpose

This project is a reusable, AI-first CAD framework built around Replicad and
TypeScript. Replicad gives the project a browser-friendly CAD language with
normal web-development ergonomics: strong typing, linting, tests, Vite, React,
and an ecosystem familiar to coding agents. An AI should be able to install the
library, generate a model, host an interactive review page, and snapshot that
page to inspect its own work.

The feedback loop is: clarify intent → build a cheap visual approximation when
the user agrees → ask focused questions or collect sketches/annotations →
build the parametric CAD model → validate geometry → present inspectable views.
The approximation is a deliberate communication tool, not a substitute for
the final model.

## Product Capabilities

- A React/Vite viewer with standard, corner, section, and multi-angle contact
  sheet views suitable for AI vision review.
- Named parts, assembly hierarchy, explode/implode states, and deterministic
  geometry checks.
- User feedback primitives: select or mark a face/edge/area, attach a note or
  sketch, and expose the selection plus context to the AI.
- A library of typed, documented parametric parts, initially including common
  fasteners such as screws, nuts, washers, and mounting features. Every part
  must record provenance and license information for sourced assets.
- Packaged agent skills that teach a staged workflow, how to ask for missing
  measurements, when to use a sketch, and how to review snapshots before
  claiming completion.

## Model Organization & Documentation

Organize models like web applications: each part or feature gets its own
folder; reusable geometry belongs in `shared/`; global constants, units,
materials, and parametric values belong in `core/`. Keep public APIs strongly
typed and enforce formatting, linting, and tests in CI.

Each model should include a concise design document containing source links,
references, units, coordinate-system assumptions, manufacturing constraints,
and a measurement table. Label values as `fixed` (interface or source
constraints), `adjustable` (user-facing parameters), or `derived` (computed
from other values). Separately record provenance and uncertainty. Export a typed parameter
schema with defaults, bounds, steps, descriptions, and groups so the UI and AI
can safely edit only intended values. Give each part a stable name and attach
its parameters, documentation, and validation results to the scene metadata.

## Research-Informed Design Principles

- Borrow OpenSCAD’s small reusable modules and explicit parameterization, but
  expose runtime TypeScript schemas instead of compile-time-only values.
- Borrow CadQuery/build123d’s selectors, locations, and assembly abstractions:
  selections should be semantic and stable rather than dependent on fragile
  face indices.
- Borrow Onshape FeatureScript’s reusable custom-feature model and versioned
  feature libraries: parts and skills should be publishable, discoverable, and
  pinned to compatible versions.
- Use Replicad’s existing CLI/export path for STEP, STL, JSON, and projections;
  treat visual review, topology checks, and export checks as separate gates.

## Initial Roadmap

1. Establish a TypeScript package with strict compiler, lint, test, and CI
   configuration while preserving the current viewer behavior.
2. Define typed `Part`, `Assembly`, `ParameterSchema`, `Annotation`, and
   `ReviewState` contracts, including stable IDs and provenance metadata.
3. Add the React/Vite review shell, annotations/sketch input, and a compact
   snapshot protocol for AI tools.
4. Move the current capture/check CLIs behind those contracts and add a small
   versioned standard-parts catalog.
5. Package the agent skills and document a repeatable approximation-to-CAD
   workflow with examples.

Deliver these through a small end-to-end example: select a part, annotate it,
change an adjustable parameter, rebuild, and review the result with geometry
checks and a revision-matched snapshot. Establish performance and token-use
baselines early; expand the catalog and caching after measuring this workflow.

## References

- [Replicad CLI](https://github.com/sgenoud/replicad/tree/main/packages/replicad-cli)
- [OpenSCAD documentation](https://openscad.org/documentation)
- [CadQuery documentation](https://cadquery.readthedocs.io/en/stable/)
- [build123d key concepts](https://build123d.readthedocs.io/en/stable/key_concepts.html)
- [Onshape FeatureScript documentation](https://cad.onshape.com/FsDoc/)
