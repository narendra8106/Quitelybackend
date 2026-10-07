# Quietly Backend

Express + MongoDB Atlas API powering the Quietly spam shield app.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env: paste your MongoDB Atlas connection string into MONGODB_URI
node utils/seed.js    # populates demo spam numbers + keyword patterns
npm run dev            # starts server with nodemon on http://localhost:5000
```

## Getting your MongoDB Atlas URI

1. Create a free cluster at https://www.mongodb.com/cloud/atlas
2. Database Access -> add a user with a password
3. Network Access -> allow access from anywhere (0.0.0.0/0) for hackathon simplicity
4. Connect -> Drivers -> copy the connection string, replace `<password>` with your user's password

## API Endpoints

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/check-call` | Called by native call screening module. Body: `{ number }` |
| POST | `/api/check-sms` | Called on incoming SMS. Body: `{ number, body }` |
| POST | `/api/check-email` | Called by Gmail scan job. Body: `{ from, subject, snippet }` |
| GET | `/api/blocked-items` | List blocked items. Query: `?channel=call\|sms\|email` |
| GET | `/api/blocked-items/summary` | Dashboard counts + recent activity |
| GET | `/api/blocked-items/coordinated` | Items flagged as coordinated cross-channel threats |
| PATCH | `/api/blocked-items/:id/mark-safe` | User marks a blocked item as a false positive |
| POST | `/api/report-spam` | User reports a number as spam. Body: `{ channel, sender, category }` |

## Folder structure

```
config/       - DB connection
models/       - Mongoose schemas (BlockedItem, SpamNumber, SpamKeywordPattern)
controllers/  - Route handler logic
routes/       - Express route definitions
utils/        - normalize.js (sender ID normalization), spamScorer.js
              (keyword scoring), correlationEngine.js (Day 6 cross-channel
              correlation), seed.js (demo data)
```

## Notes on the correlation engine (Day 6 feature)

`utils/correlationEngine.js` runs after every new BlockedItem is saved. It
checks for:
1. The same normalized sender (phone number) appearing across a different
   channel within `CORRELATION_WINDOW_MINUTES` (default 30) - e.g. a scam
   call and a scam SMS from the same number.
2. Significant keyword overlap between an email snippet and a recent
   SMS/call reason - catches a scammer reusing the same script across
   channels with different contact info.

When a match is found, both items get `isCoordinatedThreat: true` and are
cross-linked via `linkedIdentities`, which the dashboard can then surface
as a "coordinated spam attempt" banner.
