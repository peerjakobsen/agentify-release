#!/usr/bin/env python3
"""
Agentify Orchestrator - Workflow Pattern

This orchestrator coordinates remote agents using a Workflow pattern:
- Parallel execution based on a task DAG (Directed Acyclic Graph)
- Tasks with no dependencies execute in parallel
- Tasks wait for all their dependencies to complete before starting
- Maximizes throughput by executing independent tasks concurrently

USAGE:
    python agents/main.py --prompt "User request" --workflow-id "wf-123" --trace-id "32-char-hex"

ARCHITECTURE:
    main.py (local orchestrator)
        |
        | concurrent.futures.ThreadPoolExecutor
        v
    Parallel Agent Invocations
        |
        +-- Task A (no deps) ----+
        |                        |
        +-- Task B (no deps) ----+---> Task D (depends on A, B)
        |                        |
        +-- Task C (no deps) ----+---> Task E (depends on C)
                                 |
                                 +---> Task F (depends on D, E)

CUSTOMIZATION:
    Kiro customizes the CUSTOMIZATION SECTION based on .kiro/steering/ files.
    The generic infrastructure imports should not be modified.
"""

import concurrent.futures
import sys
import time
from typing import Dict, Any, List, Set

# Import common orchestrator utilities (DO NOT MODIFY)
from agents.shared.orchestrator_utils import (
    parse_arguments,
    validate_arguments,
    setup_environment,
    generate_session_id,
    get_timestamp,
    emit_event,
    invoke_agent_remotely,
    emit_workflow_error,
    print_workflow_summary,
    print_workflow_error_summary,
)


# ============================================================================
# CUSTOMIZATION SECTION (Kiro fills this in based on steering files)
# ============================================================================
# This section contains project-specific logic that Kiro customizes based on
# the steering files in .kiro/steering/. The function signatures should not
# change, but the implementations will vary per project.


def define_graph_structure() -> Dict[str, Any]:
    """
    Define the graph structure for the workflow visualization.

    CUSTOMIZED BY KIRO based on .kiro/steering/tech.md agent design.

    For Workflow pattern, edges represent dependencies between tasks.
    An edge from A to B means B depends on A (B waits for A to complete).

    Returns:
        Dict with 'nodes' and 'edges' for Demo Viewer graph visualization.

    Example for a parallel workflow:
        return {
            "nodes": [
                {"id": "data_fetch", "name": "Data Fetcher", "type": "task"},
                {"id": "analyzer", "name": "Analyzer", "type": "task"},
                {"id": "enricher", "name": "Enricher", "type": "task"},
                {"id": "aggregator", "name": "Aggregator", "type": "task"},
            ],
            "edges": [
                # aggregator depends on both analyzer and enricher
                {"from": "data_fetch", "to": "analyzer", "condition": "dependency"},
                {"from": "data_fetch", "to": "enricher", "condition": "dependency"},
                {"from": "analyzer", "to": "aggregator", "condition": "dependency"},
                {"from": "enricher", "to": "aggregator", "condition": "dependency"},
            ]
        }
    """
    # TODO: Kiro fills this in based on agent team design from steering files
    return {
        "nodes": [
            # {"id": "task_id", "name": "Display Name", "type": "task"},
        ],
        "edges": [
            # {"from": "dependency_task", "to": "dependent_task", "condition": "dependency"},
        ]
    }


def define_task_dag() -> Dict[str, List[str]]:
    """
    Define task dependencies as a Directed Acyclic Graph (DAG).

    CUSTOMIZED BY KIRO based on workflow design from steering files.

    Returns:
        Dict mapping task_id to list of task_ids it depends on.
        Tasks with empty dependency lists can run immediately.

    Example:
        return {
            "data_fetch": [],           # No dependencies - runs first
            "analyzer": ["data_fetch"], # Waits for data_fetch
            "enricher": ["data_fetch"], # Waits for data_fetch (parallel with analyzer)
            "aggregator": ["analyzer", "enricher"],  # Waits for both
        }
    """
    # TODO: Kiro fills this in based on workflow design from steering files
    return {
        # "task_id": ["dependency_id_1", "dependency_id_2"],
    }


def get_agent_display_name(agent_id: str) -> str:
    """
    Return human-readable display name for an agent.

    CUSTOMIZED BY KIRO based on agent team design.

    Args:
        agent_id: Agent identifier from config

    Returns:
        Human-readable name for display in summaries
    """
    # TODO: Kiro adds agent_id -> display_name mapping
    names = {
        # "agent_id": "Human-Readable Name",
    }
    return names.get(agent_id, agent_id)


def build_task_prompt(task_id: str, original_prompt: str,
                     dependency_results: Dict[str, Dict[str, Any]]) -> str:
    """
    Build the prompt for a task, including results from its dependencies.

    CUSTOMIZED BY KIRO based on how tasks should receive dependency outputs.

    Args:
        task_id: The task being invoked
        original_prompt: The original user prompt
        dependency_results: Results from completed dependency tasks

    Returns:
        Enhanced prompt including dependency context
    """
    # TODO: Kiro customizes how dependency results are incorporated
    # Default implementation includes all dependency responses
    if not dependency_results:
        return original_prompt

    context_parts = ["Previous task results:"]
    for dep_id, result in dependency_results.items():
        dep_name = get_agent_display_name(dep_id)
        dep_response = result.get('response', 'No response')
        context_parts.append(f"\n{dep_name}:\n{dep_response}")

    context = '\n'.join(context_parts)
    return f"{context}\n\nOriginal request: {original_prompt}"


# ============================================================================
# WORKFLOW PATTERN UTILITIES (DO NOT MODIFY)
# ============================================================================


def validate_dag(dag: Dict[str, List[str]]) -> None:
    """
    Validate that the DAG is valid (no cycles, all dependencies exist).

    Raises:
        ValueError: If DAG is invalid
    """
    all_tasks = set(dag.keys())

    # Check all dependencies exist
    for task_id, deps in dag.items():
        for dep in deps:
            if dep not in all_tasks:
                raise ValueError(f"Task '{task_id}' depends on unknown task '{dep}'")

    # Check for cycles using DFS
    def has_cycle(task: str, visited: Set[str], rec_stack: Set[str]) -> bool:
        visited.add(task)
        rec_stack.add(task)

        for dep in dag.get(task, []):
            if dep not in visited:
                if has_cycle(dep, visited, rec_stack):
                    return True
            elif dep in rec_stack:
                return True

        rec_stack.remove(task)
        return False

    visited: Set[str] = set()
    for task in dag:
        if task not in visited:
            if has_cycle(task, visited, set()):
                raise ValueError("DAG contains a cycle")


def get_ready_tasks(dag: Dict[str, List[str]], completed: Set[str]) -> List[str]:
    """
    Get tasks that are ready to execute (all dependencies satisfied).

    Args:
        dag: Task dependency graph
        completed: Set of completed task IDs

    Returns:
        List of task IDs ready to execute
    """
    ready = []
    for task_id, deps in dag.items():
        if task_id not in completed:
            if all(dep in completed for dep in deps):
                ready.append(task_id)
    return ready


# ============================================================================
# MAIN EXECUTION (DO NOT MODIFY)
# ============================================================================


def main() -> None:
    """
    Main orchestrator entry point for Workflow pattern.

    Implements a parallel workflow that:
    1. Validates the task DAG
    2. Executes tasks in parallel as their dependencies complete
    3. Continues until all tasks are done
    4. Emits JSON events for Demo Viewer visualization
    """
    session_id = None
    args = None
    start_time = time.time()
    agents_invoked: List[str] = []

    try:
        args = parse_arguments()
        validate_arguments(args)
        env_config = setup_environment()
        session_id = generate_session_id()

        print("Starting Workflow execution:", file=sys.stderr)
        print(f"  Workflow ID: {args.workflow_id}", file=sys.stderr)
        print(f"  Session ID: {session_id}", file=sys.stderr)
        print(f"  Trace ID: {args.trace_id}", file=sys.stderr)
        print(f"  Prompt: {args.prompt[:100]}{'...' if len(args.prompt) > 100 else ''}", file=sys.stderr)
        print(f"  Environment: table_name={env_config['table_name']}, region={env_config['aws_region']}", file=sys.stderr)
        print("  Pattern: Workflow (parallel DAG execution)", file=sys.stderr)
        print("", file=sys.stderr)

        # Load and validate DAG
        dag = define_task_dag()
        if not dag:
            raise ValueError("define_task_dag() returned empty DAG - Kiro must implement this")

        validate_dag(dag)
        print(f"Task DAG validated: {len(dag)} tasks", file=sys.stderr)

        # Emit graph structure for Demo Viewer
        graph_structure = define_graph_structure()
        emit_event({
            "event_type": "graph_structure",
            "timestamp": get_timestamp(),
            "session_id": session_id,
            "workflow_id": args.workflow_id,
            "trace_id": args.trace_id,
            "graph": graph_structure
        })

        # Track execution state
        completed: Set[str] = set()
        results: Dict[str, Dict[str, Any]] = {}
        failed_task = None
        failed_error = None

        # Execute tasks in parallel waves
        max_workers = min(8, len(dag))  # Limit concurrent invocations

        while len(completed) < len(dag) and failed_task is None:
            ready_tasks = get_ready_tasks(dag, completed)

            if not ready_tasks:
                if len(completed) < len(dag):
                    remaining = set(dag.keys()) - completed
                    raise ValueError(f"No tasks ready but workflow incomplete. Remaining: {remaining}")
                break

            print(f"Executing {len(ready_tasks)} tasks in parallel: {ready_tasks}", file=sys.stderr)

            # Execute ready tasks in parallel
            with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
                # Submit all ready tasks
                future_to_task = {}
                for task_id in ready_tasks:
                    agent_name = get_agent_display_name(task_id)

                    # Emit node_start event
                    emit_event({
                        "event_type": "node_start",
                        "timestamp": get_timestamp(),
                        "session_id": session_id,
                        "workflow_id": args.workflow_id,
                        "trace_id": args.trace_id,
                        "node_id": task_id,
                        "node_name": agent_name
                    })

                    # Build prompt with dependency results
                    dep_results = {dep: results[dep] for dep in dag[task_id] if dep in results}
                    task_prompt = build_task_prompt(task_id, args.prompt, dep_results)

                    # Submit task
                    future = executor.submit(invoke_agent_remotely, task_id, task_prompt, session_id)
                    future_to_task[future] = task_id

                # Collect results
                for future in concurrent.futures.as_completed(future_to_task):
                    task_id = future_to_task[future]
                    agent_name = get_agent_display_name(task_id)

                    try:
                        response = future.result()
                        results[task_id] = response
                        completed.add(task_id)
                        agents_invoked.append(task_id)

                        # Emit node_stop event (success)
                        emit_event({
                            "event_type": "node_stop",
                            "timestamp": get_timestamp(),
                            "session_id": session_id,
                            "workflow_id": args.workflow_id,
                            "trace_id": args.trace_id,
                            "node_id": task_id,
                            "node_name": agent_name,
                            "status": "completed"
                        })

                        response_preview = str(response.get('response', ''))[:100]
                        print(f"Task {task_id} completed: {response_preview}...", file=sys.stderr)

                    except Exception as e:
                        # Emit node_stop event (error)
                        emit_event({
                            "event_type": "node_stop",
                            "timestamp": get_timestamp(),
                            "session_id": session_id,
                            "workflow_id": args.workflow_id,
                            "trace_id": args.trace_id,
                            "node_id": task_id,
                            "node_name": agent_name,
                            "status": "error",
                            "error": str(e)
                        })

                        failed_task = task_id
                        failed_error = str(e)
                        print(f"Task {task_id} failed: {e}", file=sys.stderr)
                        # Don't break - let other running tasks complete

        # Check for failures
        if failed_task:
            error_msg = f"Task {failed_task} failed: {failed_error}"
            emit_workflow_error(session_id, args.workflow_id, args.trace_id, error_msg)
            print_workflow_error_summary(session_id, args.workflow_id, args.trace_id,
                                       start_time, error_msg, agents_invoked)
            sys.exit(1)

        # Workflow complete - find the final task (tasks with no dependents)
        has_dependents = set()
        for deps in dag.values():
            has_dependents.update(deps)
        final_tasks = [t for t in dag.keys() if t not in has_dependents]

        # Combine final task results
        if final_tasks:
            final_response = results.get(final_tasks[0], {})
        else:
            final_response = results.get(agents_invoked[-1], {}) if agents_invoked else {}

        emit_event({
            "event_type": "workflow_complete",
            "timestamp": get_timestamp(),
            "session_id": session_id,
            "workflow_id": args.workflow_id,
            "trace_id": args.trace_id,
            "final_agent": agents_invoked[-1] if agents_invoked else None,
            "status": "success"
        })

        print_workflow_summary(session_id, args.workflow_id, args.trace_id,
                              start_time, agents_invoked, final_response,
                              get_agent_display_name)
        sys.exit(0)

    except KeyboardInterrupt:
        print("\nWorkflow interrupted by user", file=sys.stderr)
        if session_id and args:
            emit_workflow_error(session_id, args.workflow_id, args.trace_id,
                              "Workflow interrupted by user", "interrupted")
            print_workflow_error_summary(session_id, args.workflow_id, args.trace_id,
                                       start_time, "Workflow interrupted by user", agents_invoked)
        sys.exit(130)

    except SystemExit:
        raise

    except Exception as e:
        error_msg = f"Fatal error: {e}"
        print(error_msg, file=sys.stderr)
        if session_id and args:
            emit_workflow_error(session_id, args.workflow_id, args.trace_id, str(e))
            print_workflow_error_summary(session_id, args.workflow_id, args.trace_id,
                                       start_time, str(e), agents_invoked)
        sys.exit(1)


if __name__ == '__main__':
    main()
