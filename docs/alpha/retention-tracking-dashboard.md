# Retention Tracking Dashboard

This is the alpha dashboard spec. Keep it simple.

## Core Metrics

| Metric                | Event source                                   | Meaning             |
| --------------------- | ---------------------------------------------- | ------------------- |
| Week 1 retention      | active event after day 7                       | voluntary return    |
| Week 4 retention      | active event after day 28                      | durable use         |
| Reflection recurrence | `reflection_created`                           | core loop habit     |
| Search usage          | `memory_search_used`                           | killer feature pull |
| Retrieval success     | `memory_search_evaluated`                      | search quality      |
| Insight open rate     | `weekly_insight_opened`                        | synthesis pull      |
| Insight usefulness    | `weekly_insight_rated`                         | output quality      |
| Export/delete events  | `export_requested`, `account_deletion_started` | trust/control       |

## First Dashboard

Use the backend `/api/v1/analytics/retention-summary` endpoint for per-user summaries.

For the first 10-25 testers, a manual spreadsheet is acceptable. Do not build an admin dashboard before alpha learning requires it.

## Weekly Review

Every Friday, classify each tester:

- returned voluntarily
- returned after prompt
- did not return
- used retrieval
- opened weekly insight
- gave trust concern
- would miss app

The most important cell is still: would miss app.
