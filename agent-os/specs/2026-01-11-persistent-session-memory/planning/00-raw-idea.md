# Raw Idea: Persistent Session Memory (Item 39.5)

Enable agents to learn from past workflow sessions using AgentCore Memory's semantic and event strategies. This builds on item #39 (Cross-Agent Memory) which handles within-session memory sharing.

## Key Aspects from Roadmap

- **User Preference Learning**: Remember what users like/dislike across sessions
- **Historical Context**: Access past interactions when relevant
- **Progressive Personalization**: Improve responses over time based on accumulated feedback
- **Session Continuity**: Resume interrupted workflows with full context

## Feature Components

The feature involves:

1. **Wizard Step 4 updates** for infrastructure settings (Long-Term Memory toggle, retention policy)
2. **Wizard Step 5 updates** for per-agent memory configuration
3. **New pre-bundled module** (persistent_memory.py) with tools like remember_preference, recall_preferences, log_feedback
4. **Setup script updates** for AgentCore Memory creation
5. **Demo Viewer integration** to show memory operations
6. **Steering prompt updates**

## Relationship to Other Features

This builds on item #39 (Cross-Agent Memory) which handles within-session memory sharing.
