![The stamp editor with a choice of destinations](01-two-destinations.png)

The stamp stays the same. This pass adds a choice between using it on your own document and bringing it onto the shared board.

![Two independent browser contributions composed on one board](02-independent-contributions.png)

Two separate browser sessions left marks at the same time. Both showed up on the same surface, and they were still there after refreshing. This check used the local server.

![A draft kept after a share response was interrupted](03-recoverable-share.png)

The connection dropped after the server saved the mark. The draft stayed in place. Retrying used the same submission, so it didn’t leave a second copy.

![Two technical marks loaded from the hosted shared board](04-hosted-cross-session.png)

The board is now connected to Supabase. These two T marks came from separate test sessions. A new visitor could see both after refreshing. These are technical tests, not participant work.
