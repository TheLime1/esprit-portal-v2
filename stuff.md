```
User Login/Refresh Request
         ↓
    ┌─────────────────────────────────────┐
    │  Check Local Cache (chrome.storage)  │
    └───────────────┬─────────────────────┘
                    ↓
              [Found?] ───── No ────→ Check Supabase ──→ [Found?] ──→ No ──→ Fetch Portal
                    ↓ Yes                                    ↓ Yes
            Show instantly                            Save to local cache
                    ↓                                        ↓
         ┌──────────────────────┐                    Return data + check staleness
         │ Also check Supabase  │
         └──────────┬───────────┘
                    ↓
        [Supabase newer AND fresh?]
                    ↓ Yes
         Replace local with Supabase
         Return with supabaseWasNewer: true
         ```