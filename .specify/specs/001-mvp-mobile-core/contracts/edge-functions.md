# 001 MVP — Edge Functions Contracts

All endpoints are Supabase Edge Functions.
Auth: Supabase JWT from anonymous session.
TMDB calls happen only inside Edge Functions.

Base: `POST /functions/v1/<function-name>`

## 1) create-room

### Request
```json
{
  "language": "ru",
  "region": "KZ"
}
````

### Response 200

```json
{
  "room_id": "uuid",
  "code": "AB12CD",
  "language": "ru",
  "region": "KZ",
  "status": "lobby",
  "max_members": 2
}
```

### Errors

* 400 invalid language/region format (server falls back to EN if language unsupported)
* 500 unexpected

---

## 2) join-room

### Request

```json
{ "code": "AB12CD" }
```

### Response 200

```json
{
  "room_id": "uuid",
  "status": "lobby"
}
```

### Errors

* 404 room not found
* 409 room full
* 409 room closed/matched

---

## 3) set-preferences

### Request

```json
{
  "room_id": "uuid",
  "preferences": {
    "genres": [28, 35, 18],
    "runtime_bucket": "90_120",
    "recency_years": 10,
    "sort_mode": "popular"
  }
}
```

### Response 200

```json
{
  "room_id": "uuid",
  "status": "lobby",
  "seeded": false
}
```

If this call triggers seeding (both ready), server may respond:

```json
{
  "room_id": "uuid",
  "status": "voting",
  "seeded": true,
  "current_idx": 0,
  "current_movie_id": 12345
}
```

### Errors

* 404 room not found / not a member
* 409 room not in lobby
* 422 invalid preferences (e.g., >5 genres)

---

## 4) seed-queue (optional external call)

In MVP, seeding is normally triggered internally after both preferences exist.
This endpoint can exist for debugging/admin.

### Request

```json
{ "room_id": "uuid" }
```

### Response 200

```json
{
  "room_id": "uuid",
  "status": "voting",
  "queue_size": 120,
  "current_idx": 0,
  "current_movie_id": 12345
}
```

### Errors

* 404 room not found / not a member
* 409 already seeded
* 502 TMDB error
* 422 insufficient candidates (server returns partial queue + a message if needed)

---

## 5) vote (server-authoritative, atomic)

### Request

```json
{
  "room_id": "uuid",
  "vote": 1
}
```

> The server uses `rooms.current_movie_id` as the movie being voted on.

### Response 200 (no match, advanced)

```json
{
  "room_id": "uuid",
  "status": "voting",
  "current_idx": 1,
  "current_movie_id": 67890,
  "match": null
}
```

### Response 200 (match)

```json
{
  "room_id": "uuid",
  "status": "matched",
  "current_idx": 0,
  "current_movie_id": 12345,
  "match": {
    "movie_id": 12345,
    "created_at": "2026-03-03T00:00:00Z"
  }
}
```

### Errors

* 404 room not found / not a member
* 409 room closed/matched
* 409 queue not seeded
* 422 invalid vote (must be -1 or 1)
* 500 unexpected
