# Adding cities to the WanderWise knowledge base

Each city has a curated JSON file at `data/locations/{city-slug}.json`.

## File naming
- `london.json` → matches "London", "london", "LONDON"
- `new-york-city.json` → matches "New York City"
- `sao-paulo.json` → matches "São Paulo" (accents stripped automatically)

## JSON structure

```json
{
  "city": "City Name",
  "country": "Country",
  "last_updated": "YYYY-MM",

  "restaurants": [
    {
      "name": "Restaurant Name",
      "cuisine": "Type of food",
      "price_tier": "budget|mid-range|comfort|luxury",
      "neighbourhood": "Area, Postcode",
      "indoor": true,
      "tags": ["local", "street", "markets", "offbeat", "history", "art", "cafes", "finedining", "pubs", "vegan"],
      "good_for": ["solo", "couple", "small group", "family"],
      "priority": 8,
      "description": "2-3 sentence description",
      "must_try": "Dish or drink recommendation",
      "booking_tip": "Practical tip"
    }
  ],

  "excursions": [
    {
      "name": "Activity Name",
      "duration": "2 hours",
      "price_tier": "free|budget|mid-range|comfort",
      "neighbourhood": "Area",
      "indoor": false,
      "tags": ["history", "nature", "offbeat", "art", "sport", "architecture"],
      "good_for": ["solo", "couple", "small group", "family"],
      "priority": 9,
      "description": "What makes this special",
      "booking_tip": "Practical booking info"
    }
  ],

  "hidden_gems": [
    {
      "name": "Place name",
      "neighbourhood": "Area",
      "description": "Why it's special and how to find it"
    }
  ],

  "markets": [
    {
      "name": "Market Name",
      "days": "Operating days and hours",
      "neighbourhood": "Area",
      "description": "Character and what to find there"
    }
  ],

  "seasonal_notes": [
    {
      "label": "Winter (Dec-Feb)",
      "months": [11, 0, 1],
      "notes": "What's good/bad, what events are on, what to prioritise"
    },
    {
      "label": "Spring (Mar-May)",
      "months": [2, 3, 4],
      "notes": "..."
    },
    {
      "label": "Summer (Jun-Aug)",
      "months": [5, 6, 7],
      "notes": "..."
    },
    {
      "label": "Autumn (Sep-Nov)",
      "months": [8, 9, 10],
      "notes": "..."
    }
  ],

  "local_transport_tips": [
    "Tip 1",
    "Tip 2"
  ]
}
```

## Priority scoring (1-10)
- 10: Unmissable, always include if preferences match
- 8-9: Excellent, include when relevant
- 6-7: Good option, include if space
- 1-5: Niche/seasonal, include only if directly matches preferences

## Tags (use these for matching to user preferences)
Food tags: `local`, `street`, `markets`, `cafes`, `finedining`, `pubs`, `vegan`
Interest tags: `history`, `heritage`, `art`, `nature`, `offbeat`, `architecture`, `music`, `sport`

## Production RAG upgrade
For 50+ cities, replace the JSON file lookup in `lib/rag.js` with:
1. Embed each venue description using `text-embedding-3-small` (OpenAI) or `voyage-02` (Anthropic)
2. Store in Pinecone, pgvector, or Weaviate
3. Query by combining user preference text into an embedding and doing similarity search
4. This gives semantic matching: "romantic" finds candlelit wine bars, "adventurous" finds unusual experiences

Cost: ~$0.00002 per embedding, ~$0.0001 per query — negligible.
