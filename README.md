
# Threadly

**AI Wardrobe & Resale Marketplace**

Snap your clothes. Style your closet. Sell what you no longer wear.

Threadly is a web app where people keep a digital closet, get outfit ideas from AI, and buy and sell pre-loved clothes in one place.

> 🚧 **Status:** Phase 0 (setup) is done. Phase 1 (login and roles) is next.

## Planned Features

- Digital wardrobe: add clothes with photos
- AI background removal and auto-tags (category, color, style)
- Outfit suggestions from clothes you already own
- Sell an item in one step, with the details pre-filled
- Marketplace with search, filters, cart, and checkout
- Reviews and ratings for sellers
- Shop the look: upload a photo, find similar items
- Secure login with roles and permissions
- Admin tools: moderation and audit log

## Tech Stack

| Part | Technology |
|---|---|
| Backend | ASP.NET Core Web API (C#, .NET 10) |
| Data access | Dapper |
| Database | SQL Server |
| Migrations | DbUp |
| Login | JWT tokens with refresh tokens |
| Frontend | React + TypeScript (Vite) |
| AI service | Python + FastAPI |
| Payments | Stripe (test mode) |
| Tests | xUnit |

## Project Structure

```
threadly/
  api/         Web API (backend)
  db/          SQL migration scripts
  web/         React frontend (coming soon)
  ai-service/  Python AI service (coming soon)
  docs/        Documentation (coming soon)
```

## Roadmap

| Phase | Focus | Status |
|---|---|---|
| 0 | Setup and first API | ✅ Done |
| 1 | Login, roles, permissions | ⏳ Next |
| 2 | Wardrobe and image upload | Planned |
| 3 | AI tagging | Planned |
| 4 | Marketplace, cart, payments | Planned |
| 5 | Visual search | Planned |
| 6 | Outfits, admin, deployment | Planned |

## Run the API

You need the [.NET 10 SDK](https://dotnet.microsoft.com/download).

```
cd api
dotnet run
```

The terminal shows the address, for example `http://localhost:5022`.

## Author

Léa Mazmanian