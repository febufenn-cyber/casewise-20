# Filing delta classification contract

A delta item describes how one reviewed graph object changed between two activated filing versions. It does not state which version is true or legally preferable.

## Supported change classes

- new;
- removed;
- restated;
- narrowed;
- expanded;
- amended;
- response changed;
- response-search coverage changed;
- date changed;
- amount changed;
- party or role changed;
- document reference changed;
- evidence relationship changed;
- contradiction opened or resolved;
- information gap opened or resolved.

Every non-new and non-removed delta stores both prior and current source spans. New items retain current sources; removed items retain prior sources. Material changes remain review-required until a lawyer accepts, corrects, rejects, or preserves them as unresolved.

Language containment and similarity are classification signals only. Narrowed, expanded, and restated labels remain reviewable and cannot establish substantive legal effect by themselves.
