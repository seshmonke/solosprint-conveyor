# Owner checks

Live verification is mandatory and happens **after the push, not before**.
A sprint that touches anything automation cannot check in principle
(native dialogs, touch gestures, real client behavior, physical devices)
registers it as an owner-check item **from day one**, not "we will append
it at the end" — otherwise the check ships unperformed.

## Rules

- Owner-check items do not block sprint closing. They stay unchecked in
  the sprint file until the owner runs the scenario hands-on.
- The owner walks the accumulated queue in batches, across several
  sprints.
- A check passes → its items are marked with a separate commit.
- A check finds bugs → tasks `P0` "From owner check of sprint N" go into
  the backlog and into the nearest sprint.
- Until there is a production environment, checks run on the production
  build served over the local network.

## Synthetic events are not checks

Where a test or a measurement replaces a real gesture or system event
with a synthetic one (a long press as a context-menu event, a system
dialog as a synthetic install event), the test names that next to the
check, and the sprint registers a real-gesture owner-check item. Repeated
silently, synthetic substitution erodes trust in the suite; named, it
becomes an explicit hole in the queue.
