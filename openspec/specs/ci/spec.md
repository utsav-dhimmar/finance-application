# ci Specification

## Purpose

Defines the CI verification pipeline for the repository: the quality gates every push and pull request must pass, and the execution behavior that keeps feedback fast — browser test environment reuse, concurrent test-suite execution, and task caching across runs.

## Requirements

### Requirement: CI runs the full quality gate

CI SHALL run on every push to `main` and every pull request and SHALL execute typecheck, lint, tests, and a production build across all workspace packages. The pipeline SHALL succeed only when all four gates pass, and SHALL fail if any task fails.

#### Scenario: Pull request passes all gates

- **WHEN** a pull request is opened with code that passes typecheck, lint, tests, and builds successfully
- **THEN** the CI pipeline succeeds

#### Scenario: Failing test fails the pipeline

- **WHEN** any test task fails during a CI run
- **THEN** the CI pipeline fails and reports the failing task

### Requirement: Web tests reuse the browser test environment per worker

The web test suite SHALL reuse a single browser test environment per parallel worker across test files instead of constructing a new environment for every test file. Each test file SHALL still receive a fresh browser window at file start, and all existing web tests SHALL pass in this mode without modification to test source code.

#### Scenario: Environment reuse preserves per-file isolation

- **WHEN** a web test file mutates the browser window or global objects
- **THEN** subsequent web test files in the same run do not observe that mutation

#### Scenario: No test code changes required

- **WHEN** the web test task runs with environment reuse enabled
- **THEN** all web tests pass without any changes to test source files

### Requirement: API test suites run as independent concurrent tasks

The API package's node-environment test suite and its workers-runtime test suite SHALL be independent, separately invocable test tasks. Neither suite SHALL be gated on the other's completion, and CI SHALL fail the pipeline if either suite fails.

#### Scenario: Suites are independently runnable

- **WHEN** either API test task is invoked on its own
- **THEN** it runs its suite to completion without requiring the other task to have run

#### Scenario: Failure in either suite fails CI

- **WHEN** either the node-environment suite or the workers-runtime suite fails
- **THEN** the CI pipeline fails

### Requirement: Node-environment unit suites run without per-file isolation

The `schemas` and `api-client` node test suites SHALL run with per-file worker isolation disabled after verification that all their tests pass in that mode, without modification to test source files. Any suite discovered to depend on per-file module state MUST keep per-file isolation instead.

#### Scenario: Isolation-disabled suites pass unchanged

- **WHEN** the schemas and api-client test tasks run with per-file isolation disabled
- **THEN** all tests pass without changes to test source files

### Requirement: CI persists the task cache across runs

CI SHALL persist the Turborepo task cache between workflow runs so that tasks whose inputs are unchanged since a previously cached run are reported as cached rather than re-executed. Cache restoration MUST NOT bypass correctness: a cached result SHALL only be reused when the task's input hash matches, and a missing, corrupt, or unrestorable cache SHALL NOT fail the pipeline.

#### Scenario: Unchanged packages are cached

- **WHEN** a CI run executes tasks whose inputs already produced cached results from a prior run
- **THEN** those tasks report as cache hits and their prior outputs are reused

#### Scenario: Cache problems never fail CI

- **WHEN** the task cache cannot be restored or saved during a CI run
- **THEN** the pipeline re-executes all tasks from scratch and still passes or fails solely on gate results
